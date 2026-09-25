import { z } from 'zod';
import ipaddr from 'ipaddr.js';
import type { DNSResult } from '../../src/types';
import type { Env } from '../../edge/core/contracts';
import { cached } from '../../edge/core/cache';
import {
  ApiError,
  fetchJson,
  ipSchema,
  trustedUrl,
  validateAddresses,
  validateHost,
} from '../../edge/core/security';
const dnsSchema = z.object({
  Status: z.number(),
  Answer: z
    .array(z.object({ name: z.string(), type: z.number(), TTL: z.number().nonnegative(), data: z.string() }))
    .optional(),
});
export const recordSchema = z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA', 'PTR']);
export async function dnsLookup(name: string, type: string, env: Env): Promise<DNSResult> {
  return cached(
    'dns:' + name + ':' + type + ':' + (env.DOH_URLS || 'default'),
    (r: DNSResult) => (r.answers.length ? Math.min(3600, ...r.answers.map((a) => a.TTL)) : 0),
    () => uncachedDnsLookup(name, type, env),
  );
}
async function uncachedDnsLookup(name: string, type: string, env: Env): Promise<DNSResult> {
  const providers = (env.DOH_URLS || 'https://cloudflare-dns.com/dns-query,https://dns.google/resolve')
    .split(',')
    .map((s) => s.trim());
  for (const provider of providers) {
    try {
      const url = trustedUrl(provider);
      url.searchParams.set('name', name);
      url.searchParams.set('type', type);
      const data = dnsSchema.parse(await fetchJson(url, { headers: { accept: 'application/dns-json' } }));
      if (data.Status !== 0 && data.Status !== 3) continue;
      return {
        name,
        type,
        status: data.Status,
        answers: data.Answer || [],
        source: new URL(provider).hostname,
        detection: 'Provider Detection',
      };
    } catch {
      /* Try the next configured resolver. */
    }
  }
  throw new ApiError('DNS_UNAVAILABLE', 'All configured DNS-over-HTTPS providers failed', 502);
}
export async function resolvePublic(host: string, env: Env): Promise<string[]> {
  validateHost(host);
  if (ipSchema.safeParse(host).success) return validateAddresses([host]);
  // Both families must resolve successfully; never silently ignore one failed family.
  const records = await Promise.all([dnsLookup(host, 'A', env), dnsLookup(host, 'AAAA', env)]);
  return validateAddresses(
    records.flatMap((r) => r.answers.filter((a) => a.type === 1 || a.type === 28).map((a) => a.data)),
  );
}
export function reverseName(ip: string): string {
  const parsed = ipaddr.parse(ipSchema.parse(ip));
  return parsed.kind() === 'ipv4'
    ? parsed.toByteArray().reverse().join('.') + '.in-addr.arpa'
    : parsed
        .toByteArray()
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
        .split('')
        .reverse()
        .join('.') + '.ip6.arpa';
}

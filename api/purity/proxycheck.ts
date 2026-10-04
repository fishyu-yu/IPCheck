import ipaddr from 'ipaddr.js';
import { z } from 'zod';
import { cached } from '../../edge/core/cache';
import { fetchJson, publicIp } from '../../edge/core/security';
import type { NetworkCategory, PurityInput, RiskKey, RiskSignal } from '../../src/types';
import { coalesced, protectedLookup } from './runtime';

const source = 'Proxycheck v3';
const optionalFlag = z.boolean().nullish();
const resultSchema = z.object({
  last_updated: z.string().nullish(),
  network: z.object({ type: z.string().nullish(), range: z.string().nullish() }).nullish(),
  detections: z
    .object({
      anonymous: optionalFlag,
      vpn: optionalFlag,
      proxy: optionalFlag,
      tor: optionalFlag,
      hosting: optionalFlag,
      compromised: optionalFlag,
      confidence: z.number().min(0).max(100).nullish(),
      last_seen: z.string().nullish(),
    })
    .nullish(),
});

// Use selected features only. The vendor risk score already includes VPN/hosting
// baselines, so treating it as independent abuse would double-count those factors.
export function parseProxycheck(ip: string, response: unknown): Partial<PurityInput> {
  const root = z.record(z.unknown()).parse(response);
  if (root.status !== 'ok' && root.status !== 'warning') throw new Error('Provider declined');
  const matching = Object.keys(root).find((key) => {
    try {
      return ipaddr.parse(key).toString() === ipaddr.parse(ip).toString();
    } catch {
      return false;
    }
  });
  if (!matching) throw new Error('Mismatched IP response');
  const data = resultSchema.parse(root[matching]);
  if (data.last_updated) {
    const updated = Date.parse(data.last_updated);
    if (!Number.isFinite(updated) || updated > Date.now() + 300_000 || updated < Date.now() - 30 * 86400_000)
      throw new Error('Stale or invalid provider record');
  }
  const warnings: string[] = [];
  const signals: RiskSignal[] = [];
  const flags = data.detections;
  const lastSeen = flags?.last_seen ? Date.parse(flags.last_seen) : null;
  const stalePositive =
    lastSeen !== null &&
    (!Number.isFinite(lastSeen) || lastSeen > Date.now() + 300_000 || lastSeen < Date.now() - 7 * 86400_000);
  for (const [key, value] of Object.entries({
    anonymous: flags?.anonymous,
    vpn: flags?.vpn,
    proxy: flags?.proxy,
    tor: flags?.tor,
    hosting: flags?.hosting,
    abuse: flags?.compromised,
  }) as [RiskKey, boolean | null | undefined][]) {
    if (typeof value !== 'boolean') continue;
    if (value && key !== 'hosting' && stalePositive) {
      warnings.push(
        'Proxycheck positive detections have stale or invalid observation times; checks remain unknown.',
      );
      continue;
    }
    signals.push({
      key,
      value,
      source,
      detection: 'Provider Detection',
      confidence: value && key !== 'hosting' ? (flags?.confidence ?? 75) / 100 : 1,
    });
  }
  const networkTypes: Record<string, NetworkCategory> = {
    residential: 'isp',
    wireless: 'isp',
    business: 'business',
    hosting: 'hosting',
  };
  // This describes the queried allocation's usage, never the whole ASN.
  const type = data.network?.type ? networkTypes[data.network.type.toLowerCase()] : undefined;
  const input: Partial<PurityInput> = { signals, warnings };
  if (type && data.network?.range) {
    try {
      const target = ipaddr.parse(ip),
        range = ipaddr.parseCIDR(data.network.range);
      if (target.kind() === range[0].kind() && target.match(range))
        input.companyType = { type, source: 'Proxycheck allocation usage classification', inferred: false };
    } catch {
      /* Invalid allocation cannot establish a company network category. */
    }
  }
  if (!signals.length && !input.companyType) throw new Error('No intelligence fields returned');
  if (root.status === 'warning')
    warnings.push('Proxycheck returned a quota or account warning; some checks may be limited.');
  const updated =
    data.last_updated &&
    Number.isFinite(Date.parse(data.last_updated)) &&
    Date.parse(data.last_updated) <= Date.now() + 300_000
      ? new Date(data.last_updated).toISOString()
      : null;
  input.feeds = [
    {
      source,
      url: 'https://proxycheck.io/api/',
      checked: true,
      updatedAt: updated,
      fetchedAt: new Date().toISOString(),
      origin: 'live',
      status: 'available',
    },
  ];
  return input;
}

// Deliberately opt-in via a server-side key: no shared anonymous quota is relied
// on for production, and deployments integrate using their own licensed account.
export async function proxycheckLookup(ip: string, key: string): Promise<Partial<PurityInput>> {
  if (!publicIp(ip)) return { signals: [], feeds: [], warnings: [] };
  ip = ipaddr.parse(ip).toString();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))),
  )
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const cacheKey = 'purity:proxycheck:v3:' + hash + ':' + ip;
  const failure = (): Partial<PurityInput> => ({
    signals: [],
    feeds: [
      {
        source,
        url: 'https://proxycheck.io/api/',
        checked: false,
        updatedAt: null,
        fetchedAt: new Date().toISOString(),
        origin: 'live',
        status: 'unavailable',
      },
    ],
    warnings: ['Proxycheck unavailable or quota exhausted; checks remain unknown.'],
  });
  return coalesced(cacheKey, () =>
    cached(
      cacheKey,
      (input: Partial<PurityInput>) => (input.feeds?.[0]?.checked ? 900 : 60),
      async () => {
        try {
          const url = new URL('https://proxycheck.io/v3/' + encodeURIComponent(ip));
          url.searchParams.set('key', key);
          url.searchParams.set('tag', '0');
          url.searchParams.set('ver', '24-June-2026');
          return await protectedLookup(
            'proxycheck:' + hash,
            async () => parseProxycheck(ip, await fetchJson(url)),
            { cooldownMs: 300_000 },
          );
        } catch {
          return failure();
        }
      },
    ),
  );
}

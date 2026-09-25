import ipaddr from 'ipaddr.js';
import { z } from 'zod';
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const ipSchema = z
  .string()
  .max(45)
  .refine((s) => !s.includes('%') && z.string().ip().safeParse(s).success, 'Invalid IPv4 or IPv6');
export function publicIp(ip: string): boolean {
  if (!ipSchema.safeParse(ip).success) return false;
  const parsed = ipaddr.parse(ip);
  if (parsed.range() !== 'unicast') return false;
  if (parsed.kind() === 'ipv6' && !parsed.match(ipaddr.parseCIDR('2000::/3'))) return false;
  // Conservative exclusions: documentation, translation, benchmarking, special-purpose and metadata ranges.
  const blocked =
    parsed.kind() === 'ipv4'
      ? [
          '192.0.0.0/24',
          '192.0.2.0/24',
          '198.51.100.0/24',
          '203.0.113.0/24',
          '168.63.129.16/32',
          '192.88.99.0/24',
        ]
      : ['2001::/23', '2001:db8::/32', '2002::/16', '3fff::/20'];
  return !blocked.some((cidr) => parsed.match(ipaddr.parseCIDR(cidr)));
}
export const hostSchema = z
  .string()
  .min(1)
  .max(253)
  .transform((s) => s.toLowerCase())
  .refine((s) => {
    if (ipSchema.safeParse(s).success) return true;
    if (!s.includes('.') || /^[0-9.]+$/.test(s) || /^(?:0x[0-9a-f]+|[0-9]+)$/i.test(s)) return false;
    return s.split('.').every((p) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(p));
  }, 'Enter an IP address or a fully qualified hostname without a scheme, path, or port');
export function validateHost(value: unknown): string {
  const host = hostSchema.parse(value);
  if (
    ['localhost', 'local', 'internal', 'home', 'lan', 'test', 'invalid', 'onion'].some(
      (s) => host === s || host.endsWith('.' + s),
    ) ||
    host === 'metadata.google.internal'
  )
    throw new ApiError('BLOCKED_TARGET', 'Local and special-use hostnames are not allowed');
  if (ipSchema.safeParse(host).success && !publicIp(host))
    throw new ApiError('BLOCKED_TARGET', 'Only public unicast IP addresses are allowed');
  return host;
}
export function validateAddresses(addresses: string[]): string[] {
  if (!addresses.length) throw new ApiError('DNS_EMPTY', 'The target has no public A or AAAA records', 422);
  if (addresses.some((ip) => !publicIp(ip)))
    throw new ApiError(
      'BLOCKED_TARGET',
      'Every resolved address must be public; mixed public/private answers are rejected',
    );
  return [...new Set(addresses)];
}
export const defaultPorts = [80, 443, 22, 25, 53, 110, 143, 465, 587, 993, 995, 3306, 5432, 6379];
export function validatePort(value: unknown, config?: string): number {
  const port = z.number().int().min(1).max(65535).parse(value);
  const allowed = config ? config.split(',').map(Number) : defaultPorts;
  if (!allowed.includes(port)) throw new ApiError('PORT_DENIED', 'Port is not in the deployment allowlist');
  return port;
}
export const asnSchema = z
  .string()
  .regex(/^(?:AS)?[0-9]{1,10}$/i)
  .transform((s) => Number(s.replace(/^AS/i, '')))
  .refine((n) => n > 0 && n <= 4294967295, 'Invalid ASN');
export function trustedUrl(raw: string): URL {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash)
    throw new ApiError(
      'CONFIG_ERROR',
      'Service endpoints must be HTTPS URLs without credentials or query strings',
      503,
    );
  validateHost(u.hostname.replace(/^\[|\]$/g, ''));
  return u;
}
export async function fetchJson(url: string | URL, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(4500) });
  if (!response.ok)
    throw new ApiError('PROVIDER_ERROR', 'Upstream service is unavailable or rate limited', 502);
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError('PROVIDER_ERROR', 'Empty upstream response', 502);
  const decoder = new TextDecoder();
  let text = '',
    size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new ApiError('PROVIDER_ERROR', 'Upstream response exceeds size limit', 502);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(text) as unknown;
}
export const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

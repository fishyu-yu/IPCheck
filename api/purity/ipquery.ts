import ipaddr from 'ipaddr.js';
import { z } from 'zod';
import { cached } from '../../edge/core/cache';
import { fetchJson, ipSchema, publicIp } from '../../edge/core/security';
import type { PurityInput, RiskKey, RiskSignal } from '../../src/types';
import { coalesced, protectedLookup } from './runtime';

const source = 'IPQuery';
const sourceUrl = 'https://ipquery.io/';
const optionalFlag = z.boolean().nullish();
const responseSchema = z.object({
  ip: ipSchema,
  risk: z
    .object({
      is_vpn: optionalFlag,
      is_proxy: optionalFlag,
      is_tor: optionalFlag,
      is_datacenter: optionalFlag,
    })
    .nullish(),
  error: z.unknown().optional(),
});

/** Parse only documented flags; absent/null values never establish a negative finding. */
export function parseIpquery(ip: string, response: unknown): Partial<PurityInput> {
  const data = responseSchema.parse(response);
  if (data.error !== undefined && data.error !== null && data.error !== false)
    throw new Error('Provider declined');
  if (ipaddr.parse(data.ip).toString() !== ipaddr.parse(ip).toString())
    throw new Error('Mismatched IP response');
  const signals: RiskSignal[] = [];
  for (const [key, value] of Object.entries({
    vpn: data.risk?.is_vpn,
    proxy: data.risk?.is_proxy,
    tor: data.risk?.is_tor,
    datacenter: data.risk?.is_datacenter,
  }) as [RiskKey, boolean | null | undefined][]) {
    if (typeof value !== 'boolean') continue;
    // The provider publishes no confidence metric. Do not invent one or reuse
    // its aggregate risk_score as independent abuse/bot/blacklist evidence.
    signals.push({ key, value, source, confidence: null, detection: 'Provider Detection' });
  }
  if (!signals.length) throw new Error('No intelligence fields returned');
  const fetched = new Date();
  return {
    signals,
    feeds: [
      {
        source,
        url: sourceUrl,
        checked: true,
        updatedAt: null,
        fetchedAt: fetched.toISOString(),
        expiresAt: new Date(fetched.getTime() + 900_000).toISOString(),
        origin: 'live',
        status: 'available',
      },
    ],
    warnings:
      signals.length < 4
        ? ['IPQuery did not return every supported flag; omitted checks remain unknown.']
        : [],
  };
}

// Commercial use is explicitly permitted by https://ipquery.io/ . The public
// no-key service has no numeric quota or SLA; failures keep local evidence usable.
export async function ipqueryLookup(ip: string): Promise<Partial<PurityInput>> {
  if (!publicIp(ip)) return { signals: [], feeds: [], warnings: [] };
  ip = ipaddr.parse(ip).toString();
  const cacheKey = 'purity:ipquery:v1:' + ip;
  return coalesced(cacheKey, () =>
    cached(
      cacheKey,
      (input: Partial<PurityInput>) => (input.feeds?.[0]?.checked ? 900 : 60),
      async () => {
        try {
          return await protectedLookup(
            'ipquery',
            async () => parseIpquery(ip, await fetchJson('https://api.ipquery.io/' + encodeURIComponent(ip))),
            { cooldownMs: 300_000, maxConcurrent: 4 },
          );
        } catch {
          return {
            signals: [],
            feeds: [
              {
                source,
                url: sourceUrl,
                checked: false,
                updatedAt: null,
                fetchedAt: new Date().toISOString(),
                origin: 'live',
                status: 'unavailable',
              },
            ],
            warnings: ['IPQuery unavailable or invalid; checks remain unknown.'],
          };
        }
      },
    ),
  );
}

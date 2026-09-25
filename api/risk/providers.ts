import { z } from 'zod';
import type { RiskProvider, Env } from '../../edge/core/contracts';
import type { RiskKey, RiskSignal } from '../../src/types';
import { fetchJson } from '../../edge/core/security';
import { calculateRisk } from '../../src/lib/risk';
export class IpqsProvider implements RiskProvider {
  name = 'IPQualityScore';
  constructor(private key: string) {}
  async lookup(ip: string): Promise<RiskSignal[]> {
    const schema = z.object({
      success: z.boolean(),
      vpn: z.boolean().optional(),
      proxy: z.boolean().optional(),
      tor: z.boolean().optional(),
      bot_status: z.boolean().optional(),
      recent_abuse: z.boolean().optional(),
    });
    const d = schema.parse(
      await fetchJson(
        `https://www.ipqualityscore.com/api/json/ip/${encodeURIComponent(this.key)}/${encodeURIComponent(ip)}?strictness=1&allow_public_access_points=true`,
      ),
    );
    if (!d.success) throw new Error('Provider declined');
    return (
      Object.entries({
        vpn: d.vpn,
        proxy: d.proxy,
        tor: d.tor,
        bot: d.bot_status,
        abuse: d.recent_abuse,
      }) as [RiskKey, boolean | undefined][]
    )
      .filter(([, v]) => v !== undefined)
      .map(([key, value]) => ({
        key,
        value: value ?? null,
        source: this.name,
        confidence: null,
        detection: 'Provider Detection',
      }));
  }
}
export class AbuseProvider implements RiskProvider {
  name = 'AbuseIPDB';
  constructor(private key: string) {}
  async lookup(ip: string): Promise<RiskSignal[]> {
    const schema = z.object({
      data: z.object({
        abuseConfidenceScore: z.number().min(0).max(100),
        isTor: z.boolean().optional(),
        usageType: z.string().nullable().optional(),
      }),
    });
    const d = schema.parse(
      await fetchJson(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
        { headers: { Key: this.key, Accept: 'application/json' } },
      ),
    ).data;
    const signals: RiskSignal[] = [
      {
        key: 'abuse',
        value: d.abuseConfidenceScore / 100,
        confidence: null,
        source: this.name,
        detection: 'Provider Detection',
      },
    ];
    if (d.isTor !== undefined)
      signals.push({
        key: 'tor',
        value: d.isTor,
        confidence: null,
        source: this.name,
        detection: 'Provider Detection',
      });
    if (d.usageType === 'Data Center/Web Hosting/Transit')
      for (const key of ['hosting', 'datacenter'] as const)
        signals.push({
          key,
          value: true,
          confidence: null,
          source: this.name,
          detection: 'Provider Detection',
        });
    return signals;
  }
}
export async function riskLookup(ip: string, env: Env, providers?: RiskProvider[]) {
  const configured = providers ?? [
    ...(env.IPQS_KEY ? [new IpqsProvider(env.IPQS_KEY)] : []),
    ...(env.ABUSEIPDB_KEY ? [new AbuseProvider(env.ABUSEIPDB_KEY)] : []),
  ];
  const results = await Promise.allSettled(configured.map((p) => p.lookup(ip)));
  const signals: RiskSignal[] = [],
    warnings: string[] = [];
  results.forEach((r, i) =>
    r.status === 'fulfilled' ? signals.push(...r.value) : warnings.push(configured[i].name + ' unavailable'),
  );
  if (!configured.length) warnings.push('No risk provider configured. Missing evidence does not mean safe.');
  return calculateRisk(ip, signals, warnings);
}

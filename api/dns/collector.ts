import { z } from 'zod';
import type { DnsProbeProvider, Env } from '../../edge/core/contracts';
import type { DnsSession } from '../../src/types';
import { ApiError, fetchJson, hostSchema, ipSchema, trustedUrl } from '../../edge/core/security';
const resolverSchema = z.object({
  ip: ipSchema,
  asn: z.number().nullable(),
  country: z.string().nullable(),
  organization: z.string().nullable(),
});
export class RemoteDnsProbeProvider implements DnsProbeProvider {
  name = 'Authoritative DNS collector';
  constructor(private env: Env) {}
  private async call(path: string, body: unknown) {
    if (!this.env.DNS_COLLECTOR_URL || !this.env.DNS_COLLECTOR_SECRET)
      throw new ApiError('COLLECTOR_UNAVAILABLE', 'DNS collector is not configured', 503);
    const base = trustedUrl(this.env.DNS_COLLECTOR_URL);
    return fetchJson(new URL(base.pathname.replace(/\/$/, '') + path, base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.env.DNS_COLLECTOR_SECRET}`,
      },
      body: JSON.stringify(body),
    });
  }
  async create(): Promise<DnsSession> {
    const domain = hostSchema.parse(this.env.DNS_TEST_DOMAIN);
    const id = crypto.randomUUID();
    const response = z
      .object({ token: z.string().min(16).max(512), expiresAt: z.string().datetime() })
      .parse(await this.call('/sessions', { id, hostname: `${id}.${domain}`, ttlSeconds: 120 }));
    return { supported: true, id, hostname: `${id}.${domain}`, ...response, source: this.name };
  }
  async results(id: string, token: string): Promise<DnsSession> {
    z.string().uuid().parse(id);
    z.string().min(16).max(512).parse(token);
    const d = z
      .object({ complete: z.boolean(), resolvers: z.array(resolverSchema).max(50) })
      .parse(await this.call('/results', { id, token }));
    return { ...d, supported: true, id, source: this.name };
  }
}

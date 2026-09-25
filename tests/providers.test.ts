import { afterEach, describe, expect, it, vi } from 'vitest';
import { IpInfoProvider } from '../api/lookup/providers';
import { lookupIp, currentIp } from '../api/ip/service';
import { localAdapter } from '../edge/local/adapter';
import { onRequest } from '../edge/edgeone/entry';
import { acquireProbe } from '../edge/core/ratelimit';
describe('provider normalization and platform isolation', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses real provider classification and leaves confidence unknown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              geo: { country: 'United States', country_code: 'US' },
              as: { asn: 'AS13335', name: 'Cloudflare', type: 'hosting' },
              is_hosting: true,
            }),
          ),
      ),
    );
    const result = await new IpInfoProvider('test-token').lookup('1.1.1.1');
    expect(result.type?.[0]).toMatchObject({
      value: 'Datacenter',
      confidence: null,
      detection: 'Provider Detection',
    });
  });
  it('does not infer residential from an ISP ASN', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ as: { asn: 'AS1234', type: 'isp' } }))),
    );
    expect((await new IpInfoProvider('test').lookup('8.8.8.8')).type?.[0].value).toBe('Unknown');
  });
  it('falls back after a provider failure and retains the warning', async () => {
    const result = await lookupIp('8.8.8.8', {}, [
      {
        name: 'A',
        lookup: async () => {
          throw new Error('timeout');
        },
      },
      { name: 'B', lookup: async () => ({ city: 'Mountain View' }) },
    ]);
    expect(result.city).toBe('Mountain View');
    expect(result.sources).toEqual(['B']);
    expect(result.warnings[0]).toContain('A unavailable');
  });
  it('rejects a loopback client address as public IP', async () => {
    expect(
      (
        await currentIp(
          new Request('http://localhost'),
          { GEO_FREE_PROVIDER: 'off' },
          localAdapter('127.0.0.1'),
        )
      ).ip,
    ).toBeNull();
  });
  it('gets EdgeOne client identity from context rather than headers', async () => {
    const response = await onRequest({
      request: new Request('https://test.example/api/ip', { headers: { 'x-forwarded-for': '1.1.1.1' } }),
      env: { GEO_FREE_PROVIDER: 'off' },
      clientIp: '9.9.9.9',
      geo: { cityName: 'Test city', countryCodeAlpha2: 'US', asn: 19281 },
    });
    const json = await response.json();
    expect(json.data.ip).toBe('9.9.9.9');
    expect(json.data.city).toBe('Test city');
    expect(json.data.edge.provider).toBe('EdgeOne');
  });
  it('releases the concurrency slot after completion', async () => {
    const id = crypto.randomUUID();
    const release = await acquireProbe(id);
    expect(release).not.toBeNull();
    expect(await acquireProbe(id)).toBeNull();
    release!();
    const second = await acquireProbe(id);
    expect(second).not.toBeNull();
    second!();
  });
});

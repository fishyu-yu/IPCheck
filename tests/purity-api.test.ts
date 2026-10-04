import { describe, expect, it, vi, afterEach } from 'vitest';
import { createApp } from '../api/app';
import { localAdapter } from '../edge/local/adapter';

const app = createApp(localAdapter());
const offline = { GEO_FREE_PROVIDER: 'off', PURITY_PUBLIC_FEEDS: 'off', PURITY_IPQUERY: 'off' };

describe('production purity API contract', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each(['9.9.9.10', '2606:4700::1002'])(
    'returns a finite complete fallback for %s without any configured service',
    async (ip) => {
      const fetch = vi.fn(() => {
        throw new Error('No upstream access');
      });
      vi.stubGlobal('fetch', fetch);
      const response = await app.request('/api/purity/' + encodeURIComponent(ip), {}, offline);
      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.score).toBe(50);
      expect(result.data.level).toBe('Insufficient evidence');
      expect(result.data.dimensions).toHaveLength(5);
      expect(result.data.asnType.type).toBe('unknown');
      expect(result.data.companyType.type).toBe('unknown');
      expect(result.data.neighborhood.activeBadNeighbors).toBeNull();
      expect(result.data.warnings.length).toBeGreaterThan(0);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it.each(['127.0.0.1', '192.168.0.2', '::1', 'invalid'])(
    'blocks invalid/non-public target %s before network access',
    async (ip) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const response = await app.request('/api/purity/' + encodeURIComponent(ip), {}, offline);
      expect(response.status).toBe(400);
      expect((await response.json()).success).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('advertises local purity even when paid risk providers are absent', async () => {
    const result = await (await app.request('/api/health', {}, offline)).json();
    expect(result.data.providers.purity).toBe(true);
    expect(result.data.providers.risk).toBe(false);
  });
  it('publishes the guaranteed numeric purity result in OpenAPI', async () => {
    const document = await (await app.request('/openapi.json', {}, offline)).json();
    const response = document.paths['/api/purity/{ip}'].get.responses['200'];
    expect(response.content['application/json'].schema.allOf[1].properties.data.$ref).toBe(
      '#/components/schemas/PurityResult',
    );
    expect(document.components.schemas.PurityResult.properties.score.type).toBe('integer');
    expect(document.components.schemas.PurityResult.required).toContain('neighborhood');
  });
  it('provides default keyless anonymity evidence while preserving local scoring', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ip: '8.8.8.12',
            risk: {
              is_vpn: false,
              is_proxy: false,
              is_tor: false,
              is_datacenter: false,
              risk_score: 100,
            },
          }),
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await (
      await app.request('/api/purity/8.8.8.12', {}, { ...offline, PURITY_IPQUERY: 'on' })
    ).json();
    expect(result.success).toBe(true);
    expect(result.data.model).toBe('local-purity-v2');
    expect(
      result.data.signals.filter((signal: { source: string }) => signal.source === 'IPQuery'),
    ).toHaveLength(4);
    expect(result.data.score).toBeGreaterThan(50);
    expect(result.data.coverage).toBeGreaterThanOrEqual(30);
    expect(result.data.scoreRange.min).toBeLessThanOrEqual(result.data.score);
    expect(result.data.recommendations.length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('merges equivalent IPv6 requests before gathering provider data', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ip: '2606:4700:4700::1200',
            risk: {
              is_vpn: false,
              is_proxy: false,
              is_tor: false,
              is_datacenter: false,
            },
          }),
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const responses = await Promise.all(
      ['2606:4700:4700::1200', '2606:4700:4700:0:0:0:0:1200'].map((ip) =>
        app.request('/api/purity/' + encodeURIComponent(ip), {}, { ...offline, PURITY_IPQUERY: 'on' }),
      ),
    );
    for (const response of responses) expect((await response.json()).data.ip).toBe('2606:4700:4700::1200');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

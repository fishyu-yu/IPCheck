import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseProxycheck, proxycheckLookup } from '../api/purity/proxycheck';

const entry = () => ({
  network: { type: 'Residential', range: '8.8.8.0/24' },
  detections: {
    vpn: false,
    proxy: false,
    tor: false,
    anonymous: false,
    hosting: false,
    compromised: false,
    confidence: 0,
    last_seen: null,
  },
});
describe('optional Proxycheck feature enrichment', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('extracts selected flags locally without reusing the vendor risk score', () => {
    const result = parseProxycheck('8.8.8.8', { status: 'ok', '8.8.8.8': { ...entry(), risk: 100 } });
    expect(result.signals).toHaveLength(6);
    expect(result.signals?.every((signal) => signal.value === false && signal.confidence === 1)).toBe(true);
    expect(result.companyType?.type).toBe('isp');
    expect(result.asnType).toBeUndefined();
    expect(result.neighborhood).toBeUndefined();
  });
  it('keeps omitted fields unknown and validates allocation containment', () => {
    const result = parseProxycheck('8.8.8.8', {
      status: 'ok',
      '8.8.8.8': {
        network: { type: 'Hosting', range: '9.9.9.0/24' },
        detections: { vpn: true, confidence: 60 },
      },
    });
    expect(result.signals).toEqual([expect.objectContaining({ key: 'vpn', value: true, confidence: 0.6 })]);
    expect(result.companyType).toBeUndefined();
  });
  it('does not turn stale positive observations into negative findings', () => {
    const result = parseProxycheck('8.8.8.8', {
      status: 'ok',
      '8.8.8.8': {
        detections: { vpn: true, proxy: false, confidence: 90, last_seen: '2000-01-01T00:00:00Z' },
      },
    });
    expect(result.signals).toEqual([expect.objectContaining({ key: 'proxy', value: false })]);
    expect(result.warnings?.join(' ')).toContain('stale');
  });
  it('supports canonical IPv6 response keys and rejects an unrelated target', () => {
    const result = parseProxycheck('2606:4700::1111', {
      status: 'ok',
      '2606:4700:0:0:0:0:0:1111': {
        network: { type: 'Business', range: '2606:4700::/32' },
        detections: { tor: false },
      },
    });
    expect(result.companyType?.type).toBe('business');
    expect(() => parseProxycheck('8.8.8.8', { status: 'ok', '9.9.9.9': entry() })).toThrow('Mismatched');
    expect(() => parseProxycheck('8.8.8.8', { status: 'denied', '8.8.8.8': entry() })).toThrow('declined');
  });
  it('coalesces concurrent requests and cools down failures across target IPs', async () => {
    expect(() =>
      parseProxycheck('8.8.8.8', {
        status: 'ok',
        '8.8.8.8': { ...entry(), last_updated: '2000-01-01T00:00:00Z' },
      }),
    ).toThrow('Stale');
    const fetch = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toContain('https://proxycheck.io/v3/');
      return new Response(JSON.stringify({ status: 'denied' }));
    });
    vi.stubGlobal('fetch', fetch);
    const [first, second] = await Promise.all([
      proxycheckLookup('8.8.4.4', 'quota-test'),
      proxycheckLookup('8.8.4.4', 'quota-test'),
    ]);
    expect(first.feeds?.[0].checked).toBe(false);
    expect(second.signals).toEqual([]);
    await proxycheckLookup('9.9.9.9', 'quota-test');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0])).not.toContain('provider-cache.invalid');
  });
});

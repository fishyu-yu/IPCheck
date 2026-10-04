import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let provider: typeof import('../api/purity/ipquery');
const response = (ip = '8.8.8.8') => ({
  ip,
  risk: { is_vpn: false, is_proxy: false, is_tor: false, is_datacenter: true, risk_score: 100 },
});

describe('no-key IPQuery enrichment', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('caches', undefined);
    provider = await import('../api/purity/ipquery');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('extracts documented boolean flags without copying the vendor score or undocumented abuse', () => {
    const data = provider.parseIpquery('8.8.8.8', {
      ...response(),
      risk: { ...response().risk, is_abuser: true, is_vpn: true },
      isp: { asn: 'AS15169', org: 'Google LLC', isp: 'Google LLC' },
    });
    expect(data.signals).toHaveLength(4);
    expect(data.signals?.map((signal) => signal.key)).toEqual(['vpn', 'proxy', 'tor', 'datacenter']);
    expect(
      data.signals?.every(
        (signal) => signal.confidence === null && signal.detection === 'Provider Detection',
      ),
    ).toBe(true);
    expect(data.signals?.find((signal) => signal.key === 'vpn')?.value).toBe(true);
    expect(data.signals?.find((signal) => signal.key === 'proxy')?.value).toBe(false);
    expect(data.asnType).toBeUndefined();
    expect(data.companyType).toBeUndefined();
    expect(data.neighborhood).toBeUndefined();
    expect(data.feeds?.[0]).toMatchObject({
      checked: true,
      updatedAt: null,
      origin: 'live',
      status: 'available',
    });
    expect(Date.parse(data.feeds![0].expiresAt!) - Date.parse(data.feeds![0].fetchedAt!)).toBe(900_000);
  });

  it('retains false only for explicit checks and leaves omitted or null fields unknown', () => {
    const data = provider.parseIpquery('8.8.8.8', {
      ip: '8.8.8.8',
      risk: { is_vpn: null, is_proxy: false, is_tor: undefined },
    });
    expect(data.signals).toEqual([expect.objectContaining({ key: 'proxy', value: false })]);
    expect(data.warnings?.join(' ')).toContain('omitted checks remain unknown');
    for (const risk of [
      undefined,
      null,
      {},
      { is_vpn: null, is_proxy: null, is_tor: null, is_datacenter: null },
      { risk_score: 0 },
    ]) {
      expect(() => provider.parseIpquery('8.8.8.8', { ip: '8.8.8.8', risk })).toThrow();
    }
  });

  it.each(['false', 'true', 0, 1, [], {}])(
    'rejects nonboolean flags (%j) rather than coercing them',
    (value) => {
      expect(() =>
        provider.parseIpquery('8.8.8.8', { ip: '8.8.8.8', risk: { is_vpn: value, is_tor: false } }),
      ).toThrow();
    },
  );

  it('accepts canonical IPv6 matches and rejects unrelated/missing/error identities', () => {
    const data = provider.parseIpquery('2606:4700:4700::1111', response('2606:4700:4700:0:0:0:0:1111'));
    expect(data.signals).toHaveLength(4);
    for (const invalid of [
      response('9.9.9.9'),
      { risk: response().risk },
      { ...response(), error: 'denied' },
      { ip: null, risk: response().risk },
      { ip: '8.8.8.8/32', risk: response().risk },
    ]) {
      expect(() => provider.parseIpquery('8.8.8.8', invalid)).toThrow();
    }
  });

  it.each([
    '127.0.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '192.0.2.1',
    '::1',
    '2001:db8::1',
    'invalid',
    '8.8.8.8/path',
  ])('blocks %s without sending a request', async (ip) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await provider.ipqueryLookup(ip)).toEqual({ signals: [], feeds: [], warnings: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the fixed HTTPS target with encoded canonical IPv6 and bounded fetch settings', async () => {
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.ipquery.io/2606%3A4700%3A4700%3A%3A1111');
      expect(init?.redirect).toBe('manual');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify(response('2606:4700:4700::1111')));
    });
    vi.stubGlobal('fetch', fetch);
    const data = await provider.ipqueryLookup('2606:4700:4700:0:0:0:0:1111');
    expect(data.signals).toHaveLength(4);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('coalesces simultaneous canonical-equivalent targets', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetch = vi.fn(async () => {
      await pending;
      return new Response(JSON.stringify(response('2606:4700:4700::1111')));
    });
    vi.stubGlobal('fetch', fetch);
    const calls = [
      provider.ipqueryLookup('2606:4700:4700::1111'),
      provider.ipqueryLookup('2606:4700:4700:0:0:0:0:1111'),
    ];
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    release();
    const [first, second] = await Promise.all(calls);
    expect(first).toEqual(second);
    expect(first.feeds?.[0].checked).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reuses successful results for 900 seconds then fetches new flags', async () => {
    vi.useFakeTimers();
    const start = Date.parse('2026-10-04T00:00:00Z');
    vi.setSystemTime(start);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(response())))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...response(), risk: { is_vpn: true } })));
    vi.stubGlobal('fetch', fetch);
    const first = await provider.ipqueryLookup('8.8.8.8');
    vi.setSystemTime(start + 899_999);
    expect(await provider.ipqueryLookup('8.8.8.8')).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.setSystemTime(start + 900_001);
    const refreshed = await provider.ipqueryLookup('8.8.8.8');
    expect(refreshed.signals).toEqual([expect.objectContaining({ key: 'vpn', value: true })]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('caches failures for 60 seconds and cools down the provider across IPs for five minutes', async () => {
    vi.useFakeTimers();
    const start = Date.parse('2026-10-04T00:00:00Z');
    vi.setSystemTime(start);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response())));
    vi.stubGlobal('fetch', fetch);
    const first = await provider.ipqueryLookup('8.8.8.8');
    expect(first.signals).toEqual([]);
    expect(first.feeds?.[0]).toMatchObject({ checked: false, updatedAt: null, status: 'unavailable' });
    vi.setSystemTime(start + 59_999);
    expect(await provider.ipqueryLookup('8.8.8.8')).toEqual(first);
    vi.setSystemTime(start + 60_001);
    const cooling = await provider.ipqueryLookup('8.8.8.8');
    expect(cooling.feeds?.[0].fetchedAt).not.toBe(first.feeds?.[0].fetchedAt);
    expect((await provider.ipqueryLookup('9.9.9.9')).signals).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.setSystemTime(start + 300_001);
    expect((await provider.ipqueryLookup('8.8.8.8')).signals).toHaveLength(4);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('bounds uncached concurrency at four without harming in-flight successful lookups', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetch = vi.fn(async (url: RequestInfo | URL) => {
      await pending;
      const ip = decodeURIComponent(new URL(String(url)).pathname.slice(1));
      return new Response(JSON.stringify(response(ip)));
    });
    vi.stubGlobal('fetch', fetch);
    const calls = ['8.8.1.1', '8.8.1.2', '8.8.1.3', '8.8.1.4'].map(provider.ipqueryLookup);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    const overflow = await provider.ipqueryLookup('8.8.1.5');
    expect(overflow.signals).toEqual([]);
    expect(overflow.feeds?.[0].status).toBe('unavailable');
    expect(fetch).toHaveBeenCalledTimes(4);
    release();
    expect((await Promise.all(calls)).every((result) => result.feeds?.[0].checked)).toBe(true);
  });

  it.each([
    '{"error":"denied"}',
    'not JSON',
    '{"ip":"8.8.8.8","risk":{"is_vpn":"false"}}',
    '{"ip":"8.8.8.8","risk":{"is_vpn":null}}',
  ])('degrades invalid responses without generating negative evidence (%s)', async (body) => {
    const fetch = vi.fn(async () => new Response(body));
    vi.stubGlobal('fetch', fetch);
    const data = await provider.ipqueryLookup('8.8.8.8');
    expect(data.signals).toEqual([]);
    expect(data.feeds?.[0].checked).toBe(false);
    expect(data.warnings?.join(' ')).toContain('checks remain unknown');
  });
});

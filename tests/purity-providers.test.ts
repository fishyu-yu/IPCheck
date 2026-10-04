import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ipaddr from 'ipaddr.js';
import type { Env } from '../edge/core/contracts';

const enrichment = vi.hoisted(() => ({ network: vi.fn(), ipquery: vi.fn() }));
vi.mock('../api/purity/network-feeds', () => ({ collectNetworkPurity: enrichment.network }));
vi.mock('../api/purity/ipquery', () => ({ ipqueryLookup: enrichment.ipquery }));

const copyright = '© 2026 The Spamhaus Project';
const timestamp = Math.floor(Date.now() / 1000);
const drop = (cidrs: string[]) =>
  [
    ...cidrs.map((cidr) => JSON.stringify({ cidr, sblid: 'SBL-test' })),
    JSON.stringify({ type: 'metadata', timestamp, copyright }),
  ].join('\n');
const row = (ip_address: string, status = 'online', last_online: string | null = null) => ({
  ip_address,
  status,
  last_online,
});

function fixtures(
  overrides: Partial<
    Record<'drop4' | 'drop6' | 'feodo' | 'tor' | 'cins' | 'ipapi' | 'geo', string | Response | Error>
  > = {},
) {
  const bodies = {
    drop4: drop(['9.9.9.0/24']),
    drop6: drop(['2606:4700:100::/48']),
    feodo: '[]',
    tor: '# Tor exit nodes\n9.9.9.8\n',
    cins: new Error('CINS fixture unavailable'),
    ipapi: '{}',
    geo: JSON.stringify({
      success: true,
      connection: { asn: 123, isp: 'Example Telecom', org: 'Example Hosting' },
    }),
    ...overrides,
  };
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();
    const name = url.includes('drop_v4')
      ? 'drop4'
      : url.includes('drop_v6')
        ? 'drop6'
        : url.includes('feodotracker')
          ? 'feodo'
          : url.includes('torbulkexitlist')
            ? 'tor'
            : url.includes('cinsscore.com')
              ? 'cins'
              : url.includes('api.ipapi.is')
                ? 'ipapi'
                : url.includes('ipwho.is')
                  ? 'geo'
                  : null;
    if (!name) throw new Error('Unexpected fixture URL: ' + url);
    const body = bodies[name];
    if (body instanceof Error) throw body;
    if (body instanceof Response) return body.clone();
    return new Response(body);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

async function collect(ip = '8.8.8.8', env: Env = { GEO_FREE_PROVIDER: 'off' }) {
  const { collectPurity } = await import('../api/purity/providers');
  return collectPurity(ip, env);
}

describe('production purity evidence gathering', () => {
  beforeEach(() => {
    vi.resetModules();
    enrichment.network.mockReset().mockResolvedValue({ signals: [], feeds: [], warnings: [] });
    enrichment.ipquery.mockReset().mockResolvedValue({ signals: [], feeds: [], warnings: [] });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves Spamhaus JSONL copyright/date and performs narrow negative checks', async () => {
    const mock = fixtures();
    const result = await collect();
    expect(result.feeds).toContainEqual(
      expect.objectContaining({
        source: 'Spamhaus Project DROP',
        url: 'https://www.spamhaus.org/drop/drop_v4.json',
        checked: true,
        updatedAt: new Date(timestamp * 1000).toISOString(),
        copyright,
      }),
    );
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'blacklist', value: false, source: 'Spamhaus Project DROP' }),
        expect.objectContaining({ key: 'tor', value: false }),
      ]),
    );
    expect(result.signals.some((signal) => signal.key === 'abuse' && signal.value === false)).toBe(false);
    expect(mock).toHaveBeenCalledTimes(3);
    expect(mock.mock.calls.some(([url]) => url.toString().includes('cinsscore.com'))).toBe(false);
  });

  it('matches IPv4 CIDRs and counts unique other malicious /24 addresses', async () => {
    fixtures({
      drop4: drop(['8.8.8.0/24']),
      feodo: JSON.stringify([
        row('8.8.8.8'),
        row('8.8.8.9'),
        row('8.8.8.9'),
        row('8.8.9.9'),
        row('8.8.8.10', 'offline', '2000-01-01'),
      ]),
    });
    const result = await collect();
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'blacklist', value: true }),
        expect.objectContaining({ key: 'bot', value: true }),
        expect.objectContaining({ key: 'abuse', value: true }),
      ]),
    );
    expect(result.neighborhood).toMatchObject({
      cidr: '8.8.8.0/24',
      activeBadNeighbors: 1,
      abuseDensity: null,
      scope: 'ipv4-/24',
      activityCidr: '8.8.8.0/24',
      activitySource: 'abuse.ch Feodo Tracker',
    });
  });

  it('matches IPv6 CIDRs while leaving absent IPv6 Tor and neighborhood unknown', async () => {
    const mock = fixtures({ drop6: drop(['2606:4700::/32']) });
    const result = await collect('2606:4700::1111');
    expect(result.signals).toContainEqual(expect.objectContaining({ key: 'blacklist', value: true }));
    expect(result.signals.some((signal) => signal.key === 'tor')).toBe(false);
    expect(result.neighborhood).toBeUndefined();
    expect(result.feeds.find((feed) => feed.source.includes('Tor'))?.checked).toBe(false);
    expect(result.feeds.find((feed) => feed.source.includes('Feodo'))?.checked).toBe(false);
    expect(mock.mock.calls.some(([url]) => url.toString().includes('drop_v4'))).toBe(false);
  });

  it('normalizes equivalent IPv6 spelling for Tor matches', async () => {
    fixtures({ tor: '2606:4700:0:0:0:0:0:1111\n9.9.9.8' });
    expect((await collect('2606:4700::1111')).signals).toContainEqual(
      expect.objectContaining({ key: 'tor', value: true }),
    );
  });

  it.each([
    { drop4: '<html>error</html>' },
    { drop4: JSON.stringify({ cidr: '8.8.8.0/24' }) },
    { drop4: drop(['2606:4700::/32']) },
    { drop4: drop([]) },
  ])('rejects malformed, metadata-free and wrong-family DROP feeds', async (override) => {
    fixtures(override);
    const result = await collect();
    expect(result.feeds.find((feed) => feed.source.includes('Spamhaus'))?.checked).toBe(false);
    expect(result.signals.some((signal) => signal.key === 'blacklist')).toBe(false);
    expect(result.feeds.filter((feed) => feed.checked)).toHaveLength(2);
  });

  it('accepts empty Feodo JSON, but rejects malformed Feodo and empty Tor', async () => {
    fixtures({ feodo: '[{"ip_address":"8.8.8.9"}]', tor: '# comment only' });
    const result = await collect();
    expect(result.feeds.filter((feed) => feed.checked)).toHaveLength(1);
    expect(result.neighborhood).toBeUndefined();
    expect(result.signals.some((signal) => signal.key === 'tor' || signal.key === 'bot')).toBe(false);
  });

  it('retains partial evidence and cools down failures without throwing', async () => {
    const mock = fixtures({
      drop4: new Error('offline'),
      feodo: new Error('offline'),
      tor: new Error('offline'),
    });
    const first = await collect();
    const second = await collect('1.1.1.1');
    expect(first.feeds).toHaveLength(4);
    expect(second.feeds.every((feed) => !feed.checked)).toBe(true);
    expect(first.signals).toEqual([]);
    expect(first.warnings.some((warning) => warning.includes('unavailable'))).toBe(true);
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it.each([-72 * 3600, 3600])('rejects stale or future Spamhaus timestamps', async (offset) => {
    fixtures({
      drop4: [
        JSON.stringify({ cidr: '8.8.8.0/24' }),
        JSON.stringify({ timestamp: timestamp + offset, copyright }),
      ].join('\n'),
    });
    const result = await collect();
    expect(result.feeds.find((feed) => feed.source.includes('Spamhaus'))?.checked).toBe(false);
    expect(result.signals.some((signal) => signal.key === 'blacklist')).toBe(false);
  });

  it('rejects stale Feodo metadata and limits offline C2 recency to 24 hours', async () => {
    fixtures({
      feodo: new Response('[]', {
        headers: { 'Last-Modified': new Date(Date.now() - 48 * 3600_000).toUTCString() },
      }),
    });
    expect((await collect()).feeds.find((feed) => feed.source.includes('Feodo'))?.checked).toBe(false);
    vi.resetModules();
    fixtures({
      feodo: JSON.stringify([
        row('8.8.8.9', 'offline', new Date(Date.now() - 12 * 3600_000).toISOString()),
        row('8.8.8.10', 'offline', new Date(Date.now() - 48 * 3600_000).toISOString()),
      ]),
    });
    expect((await collect()).neighborhood?.activeBadNeighbors).toBe(1);
  });

  it('interprets Feodo timestamps without timezone offsets as UTC', async () => {
    const utcTimestamp = new Date(Date.now() - 23 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
    fixtures({ feodo: JSON.stringify([row('8.8.8.9', 'offline', utcTimestamp)]) });
    expect((await collect()).neighborhood?.activeBadNeighbors).toBe(1);
  });

  it('falls back to fresh CINS reputation data while preserving failed Feodo status', async () => {
    const mock = fixtures({
      feodo: new Response('[]', {
        headers: { 'Last-Modified': new Date(Date.now() - 48 * 3600_000).toUTCString() },
      }),
      cins: new Response('8.8.8.8\n8.8.8.9\n8.8.8.9\n8.8.8.10\n8.8.9.10', {
        headers: { 'Last-Modified': new Date().toUTCString() },
      }),
    });
    const result = await collect();
    expect(result.neighborhood).toMatchObject({
      cidr: '8.8.8.0/24',
      activeBadNeighbors: 2,
      activityCidr: '8.8.8.0/24',
      activitySource: 'CINS Army',
      activityKind: 'threat-list',
      source: 'CINS Army',
    });
    expect(result.signals.filter((signal) => signal.source === 'CINS Army')).toEqual([
      expect.objectContaining({ key: 'abuse', value: 0.6 }),
    ]);
    expect(result.feeds.find((feed) => feed.source.includes('Feodo'))).toMatchObject({
      checked: false,
      updatedAt: expect.any(String),
    });
    expect(result.feeds.find((feed) => feed.source === 'CINS Army')?.checked).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('individual activity times'))).toBe(true);
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it.each([
    new Response('', { headers: { 'Last-Modified': new Date().toUTCString() } }),
    new Response('<html>Error</html>', { headers: { 'Last-Modified': new Date().toUTCString() } }),
    new Response('8.8.8.9'),
    new Response('8.8.8.9', {
      headers: { 'Last-Modified': new Date(Date.now() - 48 * 3600_000).toUTCString() },
    }),
    new Response('8.8.8.9', { headers: { 'Last-Modified': new Date(Date.now() + 3600_000).toUTCString() } }),
    new Response('2606:4700::1111', { headers: { 'Last-Modified': new Date().toUTCString() } }),
  ])('keeps malformed, stale or uncovered CINS fallback evidence unknown', async (response) => {
    fixtures({ feodo: new Error('offline'), cins: response });
    const result = await collect();
    expect(result.feeds.find((feed) => feed.source === 'CINS Army')?.checked).toBe(false);
    expect(result.neighborhood).toBeUndefined();
    expect(result.signals.some((signal) => signal.source === 'CINS Army')).toBe(false);
  });

  it('does not assume IPv6 coverage from a fresh IPv4 CINS list', async () => {
    fixtures({ cins: new Response('8.8.8.9', { headers: { 'Last-Modified': new Date().toUTCString() } }) });
    const result = await collect('2606:4700::1111');
    expect(result.feeds.find((feed) => feed.source.includes('Feodo'))?.checked).toBe(false);
    expect(result.feeds.find((feed) => feed.source === 'CINS Army')?.checked).toBe(false);
    expect(result.neighborhood).toBeUndefined();
  });

  it('coalesces conditional CINS fallback across simultaneous lookups', async () => {
    const mock = fixtures({
      feodo: new Error('offline'),
      cins: new Response('8.8.8.9', { headers: { 'Last-Modified': new Date().toUTCString() } }),
    });
    const { collectPurity } = await import('../api/purity/providers');
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        collectPurity('8.8.8.' + (index + 1), { GEO_FREE_PROVIDER: 'off' }),
      ),
    );
    expect(mock.mock.calls.filter(([url]) => url.toString().includes('cinsscore.com'))).toHaveLength(1);
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it('protects feed intervals from eviction by hundreds of target caches', async () => {
    const mock = fixtures();
    await collect();
    const { cached } = await import('../edge/core/cache');
    for (let index = 0; index < 510; index++) await cached('fixture-churn:' + index, 900, async () => index);
    await collect('1.1.1.1');
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it('coalesces public feed downloads across simultaneous IP lookups', async () => {
    const mock = fixtures();
    const { collectPurity } = await import('../api/purity/providers');
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        collectPurity('8.8.8.' + (index + 1), { GEO_FREE_PROVIDER: 'off' }),
      ),
    );
    expect(mock).toHaveBeenCalledTimes(3);
    expect(results.every((result) => result.feeds.length === 3)).toBe(true);
  });

  it('enforces download size limits and bounded timeouts', async () => {
    const mock = fixtures({ drop4: new Response('too large', { headers: { 'Content-Length': '2000001' } }) });
    const result = await collect();
    expect(result.feeds.find((feed) => feed.source.includes('Spamhaus'))?.checked).toBe(false);
    const fetchOptions = (mock.mock.calls as unknown as [string, RequestInit][]).map((call) => call[1]);
    // The fixture spy only declares the input parameter, but fetch calls still retain init.
    expect(
      fetchOptions.every((options) => options.redirect === 'manual' && options.signal instanceof AbortSignal),
    ).toBe(true);
  });

  it('infers ASN and company types independently with conservative word boundaries', async () => {
    fixtures();
    const result = await collect('8.8.8.8', {});
    expect(result.asnType).toMatchObject({ type: 'isp', inferred: true });
    expect(result.companyType).toMatchObject({ type: 'hosting', inferred: true });
  });

  it('leaves ambiguous organization names unknown', async () => {
    fixtures({
      geo: JSON.stringify({ success: true, connection: { isp: 'Ghost Industries', org: 'Telecompany Ltd' } }),
    });
    const result = await collect('8.8.8.8', {});
    expect(result.asnType?.type).toBe('unknown');
    expect(result.companyType?.type).toBe('unknown');
  });

  it('preserves actual IPinfo classifications independently of name inference', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              as: { asn: 'AS1234', name: 'Example Hosting', type: 'isp' },
              company: { name: 'Example Telecom', type: 'hosting' },
            }),
          ),
      ),
    );
    const result = await collect('8.8.8.8', { IPINFO_TOKEN: 'fixture-token', PURITY_PUBLIC_FEEDS: 'off' });
    expect(result.asnType).toEqual({ type: 'isp', source: 'IPinfo ASN classification', inferred: false });
    expect(result.companyType).toEqual({
      type: 'hosting',
      source: 'IPinfo company classification',
      inferred: false,
    });
    expect(result.warnings.some((warning) => warning.includes('types use conservative local'))).toBe(false);
  });

  it('uses keyed POST classification and company abuse fraction, preserving neighbor scope', async () => {
    const mock = fixtures({
      feodo: JSON.stringify([row('8.8.8.9')]),
      ipapi: JSON.stringify({
        ip: '8.8.8.8',
        asn: { type: 'isp' },
        company: { type: 'hosting', network: '8.8.8.0 - 8.8.8.255', abuser_score: '0.125 (High)' },
        is_vpn: false,
        is_proxy: true,
        is_tor: false,
        is_abuser: false,
      }),
    });
    const result = await collect('8.8.8.8', { GEO_FREE_PROVIDER: 'off', IPAPI_KEY: 'test-secret' });
    expect(result.asnType).toMatchObject({ type: 'isp', inferred: false });
    expect(result.companyType).toMatchObject({ type: 'hosting', inferred: false });
    expect(result.neighborhood).toMatchObject({
      scope: 'company-network',
      cidr: '8.8.8.0 - 8.8.8.255',
      abuseDensity: 0.125,
      activeBadNeighbors: 1,
      activityCidr: '8.8.8.0/24',
    });
    expect(result.signals).toContainEqual(
      expect.objectContaining({ key: 'proxy', value: true, source: 'ipapi.is' }),
    );
    const call = (mock.mock.calls as unknown as [string, RequestInit][]).find(([url]) =>
      url.includes('api.ipapi.is'),
    )!;
    expect(call[0]).toBe('https://api.ipapi.is');
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body as string)).toEqual({ q: '8.8.8.8', key: 'test-secret' });
  });

  it('does not treat the anonymous string schema as typed keyed intelligence', async () => {
    fixtures({
      ipapi: JSON.stringify({
        ip: '8.8.8.8',
        asn: 'AS15169 Google LLC',
        company: 'cloud',
        docs: 'https://ipapi.is/free-tier.html',
      }),
    });
    const result = await collect('8.8.8.8', { GEO_FREE_PROVIDER: 'off', IPAPI_KEY: 'test-secret' });
    expect(result.asnType?.inferred).toBe(true);
    expect(result.companyType?.inferred).toBe(true);
    expect(result.signals.some((signal) => signal.source === 'ipapi.is')).toBe(false);
    expect(result.warnings.some((warning) => warning.includes('valid keyed intelligence'))).toBe(true);
  });

  it('isolates cached intelligence when API credentials rotate', async () => {
    const mock = fixtures({ ipapi: JSON.stringify({ ip: '8.8.8.8', asn: { type: 'isp' } }) });
    await collect('8.8.8.8', { GEO_FREE_PROVIDER: 'off', IPAPI_KEY: 'first-key' });
    fixtures({ ipapi: JSON.stringify({ ip: '8.8.8.8', asn: { type: 'hosting' } }) });
    const second = await collect('8.8.8.8', { GEO_FREE_PROVIDER: 'off', IPAPI_KEY: 'rotated-key' });
    expect(second.asnType?.type).toBe('hosting');
    expect(mock.mock.calls.filter(([url]) => url.toString().includes('api.ipapi.is'))).toHaveLength(1);
  });

  it('isolates organization cache when free-provider configuration changes', async () => {
    const mock = fixtures();
    expect((await collect('8.8.8.8', {})).asnType?.type).toBe('isp');
    expect((await collect('8.8.8.8', { GEO_FREE_PROVIDER: 'off' })).asnType?.type).toBe('unknown');
    expect(mock.mock.calls.filter(([url]) => url.toString().includes('ipwho.is'))).toHaveLength(1);
  });

  it('rejects out-of-network or malformed company abuse densities', async () => {
    fixtures({
      ipapi: JSON.stringify({
        ip: '8.8.8.8',
        asn: { type: 'banking' },
        company: { network: '1.1.1.0/24', abuser_score: '0.1 (Low)' },
      }),
    });
    const result = await collect('8.8.8.8', { GEO_FREE_PROVIDER: 'off', IPAPI_KEY: 'test-secret' });
    expect(result.asnType?.type).toBe('business');
    expect(result.neighborhood?.scope).toBe('ipv4-/24');
    expect(result.neighborhood?.abuseDensity).toBeNull();
  });

  it('supports configured feed disablement and skips unconfigured paid APIs', async () => {
    const mock = fixtures();
    const result = await collect('8.8.8.8', { GEO_FREE_PROVIDER: 'off', PURITY_PUBLIC_FEEDS: 'off' });
    expect(mock).not.toHaveBeenCalled();
    expect(result.feeds).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('disabled'))).toBe(true);
  });

  it('never contacts providers for private or invalid addresses', async () => {
    const mock = fixtures();
    expect((await collect('127.0.0.1')).signals).toEqual([]);
    expect((await collect('invalid')).warnings).toContain(
      'Purity assessment requires a public unicast address',
    );
    expect(mock).not.toHaveBeenCalled();
  });

  it('uses prebuilt membership, neighbor and CIDR indexes for warm 15,000-address feeds', async () => {
    const addresses = [
      '8.8.8.8',
      '8.8.8.9',
      ...Array.from({ length: 14998 }, (_, index) => `9.9.${Math.floor(index / 256)}.${index % 256}`),
    ];
    const mock = fixtures({
      feodo: new Error('offline'),
      cins: new Response(addresses.join('\n'), {
        headers: { 'Last-Modified': new Date().toUTCString() },
      }),
    });
    expect((await collect()).neighborhood?.activeBadNeighbors).toBe(1);
    const parse = vi.spyOn(ipaddr, 'parse');
    const cidr = vi.spyOn(ipaddr, 'parseCIDR');
    for (let index = 10; index < 30; index++) {
      const result = await collect(`8.8.8.${index}`);
      expect(result.neighborhood?.activeBadNeighbors).toBe(2);
    }
    // A per-query scan of the feed would parse hundreds of thousands of IPs.
    // The bound allows target validation while proving the feed index is reused.
    expect(parse.mock.calls.length).toBeLessThan(300);
    expect(cidr).not.toHaveBeenCalledWith('9.9.9.0/24');
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it('coalesces simultaneous same-IP geo and configured risk lookups', async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      return new Response(
        JSON.stringify(
          input.toString().includes('ipqualityscore')
            ? { success: true, vpn: false, proxy: false, tor: false, recent_abuse: false }
            : { success: true, connection: { asn: 123, isp: 'Example Telecom', org: 'Example Telecom' } },
        ),
      );
    });
    vi.stubGlobal('fetch', mock);
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        collect('8.8.8.8', {
          PURITY_PUBLIC_FEEDS: 'off',
          IPQS_KEY: 'fixture-key',
        }),
      ),
    );
    expect(mock).toHaveBeenCalledTimes(2);
    expect(results.every((result) => result.signals.some((signal) => signal.key === 'vpn'))).toBe(true);
  });

  it('cools down each failing provider across changing target IPs and permits recovery', async () => {
    const mock = vi.fn(async () => new Response('{}', { status: 429 }));
    vi.stubGlobal('fetch', mock);
    const env = {
      PURITY_PUBLIC_FEEDS: 'off',
      IPAPI_KEY: 'fixture-key',
      IPQS_KEY: 'fixture-key',
      ABUSEIPDB_KEY: 'fixture-key',
    };
    await collect('8.8.8.8', env);
    await collect('8.8.8.9', env);
    await collect('8.8.8.10', env);
    expect(mock).toHaveBeenCalledTimes(4);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 60_001);
    await collect('8.8.8.11', env);
    expect(mock).toHaveBeenCalledTimes(8);
  });

  it('preserves healthy risk providers while another provider is cooling down', async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      if (input.toString().includes('ipqualityscore')) return new Response('{}', { status: 429 });
      return new Response(JSON.stringify({ data: { abuseConfidenceScore: 0, isTor: false } }));
    });
    vi.stubGlobal('fetch', mock);
    const env = {
      GEO_FREE_PROVIDER: 'off',
      PURITY_PUBLIC_FEEDS: 'off',
      IPQS_KEY: 'fixture-key',
      ABUSEIPDB_KEY: 'fixture-key',
    };
    for (const ip of ['8.8.8.8', '8.8.8.9', '8.8.8.10']) {
      const result = await collect(ip, env);
      expect(result.signals).toContainEqual(
        expect.objectContaining({ source: 'AbuseIPDB', key: 'abuse', value: 0 }),
      );
    }
    expect(mock.mock.calls.filter(([input]) => input.toString().includes('ipqualityscore'))).toHaveLength(1);
    expect(mock.mock.calls.filter(([input]) => input.toString().includes('abuseipdb'))).toHaveLength(3);
  });

  it('limits cold-provider concurrency during a burst of different targets', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mock = vi.fn(async () => {
      await gate;
      return new Response('{}', { status: 429 });
    });
    vi.stubGlobal('fetch', mock);
    const pending = Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        collect(`8.8.8.${index + 1}`, {
          PURITY_PUBLIC_FEEDS: 'off',
        }),
      ),
    );
    await vi.waitFor(() => expect(mock).toHaveBeenCalledTimes(4));
    release();
    const results = await pending;
    expect(mock).toHaveBeenCalledTimes(4);
    expect(results.every((result) => result.signals.length === 0)).toBe(true);
  });

  it('keeps a warm keyed result available during the provider circuit cooldown', async () => {
    const mock = fixtures({ ipapi: JSON.stringify({ ip: '8.8.8.8', is_vpn: false }) });
    const env = { GEO_FREE_PROVIDER: 'off', PURITY_PUBLIC_FEEDS: 'off', IPAPI_KEY: 'fixture-key' };
    await collect('8.8.8.8', env);
    // A mismatched response for another target opens only the provider circuit.
    await collect('8.8.8.9', env);
    const warm = await collect('8.8.8.8', env);
    expect(warm.signals).toContainEqual(
      expect.objectContaining({ source: 'ipapi.is', key: 'vpn', value: false }),
    );
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('rechecks cached DROP freshness without violating its hourly fetch interval', async () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const mock = fixtures({
      drop4: [
        JSON.stringify({ cidr: '9.9.9.0/24' }),
        JSON.stringify({ timestamp: Math.floor((now - 48 * 3600_000 + 30_000) / 1000), copyright }),
      ].join('\n'),
    });
    expect((await collect()).feeds.find((feed) => feed.source.includes('Spamhaus'))?.checked).toBe(true);
    nowSpy.mockReturnValue(now + 31_000);
    const result = await collect('8.8.8.9');
    expect(result.feeds.find((feed) => feed.source.includes('Spamhaus'))).toMatchObject({
      checked: false,
      status: 'stale',
    });
    expect(result.signals.some((signal) => signal.key === 'blacklist')).toBe(false);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it('does not label retrieval time as an unpublished feed timestamp', async () => {
    fixtures();
    const result = await collect();
    expect(result.feeds.find((feed) => feed.source.includes('Tor'))).toMatchObject({
      updatedAt: null,
      fetchedAt: expect.any(String),
      expiresAt: expect.any(String),
      status: 'available',
    });
  });

  it('rejects future Feodo activity even when an entry claims to be online', async () => {
    fixtures({
      feodo: JSON.stringify([row('8.8.8.8', 'online', new Date(Date.now() + 3600_000).toISOString())]),
    });
    const result = await collect();
    expect(result.feeds.find((feed) => feed.source.includes('Feodo'))?.checked).toBe(false);
    expect(result.signals.some((signal) => signal.key === 'bot')).toBe(false);
  });

  it('merges local positive VPN and hosting evidence while preserving independent ASN classification', async () => {
    const feed = {
      source: 'Google Cloud public ranges',
      url: 'https://www.gstatic.com/ipranges/cloud.json',
      checked: true,
      updatedAt: new Date().toISOString(),
      origin: 'snapshot',
      status: 'available',
    };
    enrichment.network.mockResolvedValue({
      companyType: { type: 'hosting', source: 'Google Cloud public ranges', inferred: false },
      signals: [
        {
          key: 'vpn',
          value: true,
          source: 'X4B VPN ranges',
          confidence: 0.6,
          detection: 'Estimated / Unsupported',
        },
        {
          key: 'hosting',
          value: true,
          source: 'Google Cloud public ranges',
          confidence: 1,
          detection: 'Provider Detection',
        },
      ],
      feeds: [feed],
      warnings: ['Local network evidence was retained'],
    });
    fixtures({
      geo: JSON.stringify({
        success: true,
        connection: { asn: 123, isp: 'Example Telecom', org: 'Example Telecom' },
      }),
    });
    const result = await collect('8.8.8.8', { PURITY_PUBLIC_FEEDS: 'off' });
    expect(result.asnType).toMatchObject({ type: 'isp', inferred: true });
    expect(result.companyType).toEqual({
      type: 'hosting',
      source: 'Google Cloud public ranges',
      inferred: false,
    });
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'vpn', value: true, confidence: 0.6 }),
        expect.objectContaining({ key: 'hosting', value: true, confidence: 1 }),
      ]),
    );
    expect(result.feeds).toContainEqual(feed);
    expect(result.warnings).toContain('Local network evidence was retained');
    expect(enrichment.network).toHaveBeenCalledWith('8.8.8.8', { refresh: false });
  });

  it('retains actual provider ASN and company classifications alongside conflicting local network flags', async () => {
    enrichment.network.mockResolvedValue({
      companyType: { type: 'hosting', source: 'Google Cloud public ranges', inferred: false },
      signals: [
        {
          key: 'hosting',
          value: true,
          source: 'Google Cloud public ranges',
          confidence: 1,
          detection: 'Provider Detection',
        },
      ],
      feeds: [],
      warnings: [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              as: { asn: 'AS1234', name: 'Example Telecom', type: 'isp' },
              company: { name: 'Example Business', type: 'business' },
            }),
          ),
      ),
    );
    const result = await collect('8.8.8.8', { IPINFO_TOKEN: 'fixture-token', PURITY_PUBLIC_FEEDS: 'off' });
    expect(result.asnType).toEqual({ type: 'isp', source: 'IPinfo ASN classification', inferred: false });
    expect(result.companyType).toEqual({
      type: 'business',
      source: 'IPinfo company classification',
      inferred: false,
    });
    expect(result.signals).toContainEqual(
      expect.objectContaining({ key: 'hosting', value: true, source: 'Google Cloud public ranges' }),
    );
  });

  it('preserves public threat checks when local network enrichment fails', async () => {
    enrichment.network.mockRejectedValue(new Error('Invalid local index'));
    fixtures();
    const result = await collect();
    expect(result.signals).toContainEqual(expect.objectContaining({ key: 'tor', value: false }));
    expect(result.signals).toContainEqual(expect.objectContaining({ key: 'blacklist', value: false }));
    expect(result.warnings).toContain('Local network classification unavailable');
  });

  it('merges default IPQuery flags and source diagnostics without replacing organization evidence', async () => {
    const feed = {
      source: 'IPQuery',
      url: 'https://ipquery.io/',
      checked: true,
      updatedAt: null,
      origin: 'live',
      status: 'available',
    };
    enrichment.ipquery.mockResolvedValue({
      signals: [
        { key: 'vpn', value: true, source: 'IPQuery', confidence: null, detection: 'Provider Detection' },
        { key: 'proxy', value: false, source: 'IPQuery', confidence: null, detection: 'Provider Detection' },
        { key: 'tor', value: false, source: 'IPQuery', confidence: null, detection: 'Provider Detection' },
        {
          key: 'datacenter',
          value: false,
          source: 'IPQuery',
          confidence: null,
          detection: 'Provider Detection',
        },
      ],
      feeds: [feed],
      warnings: [],
    });
    fixtures();
    const result = await collect('8.8.8.8', { PURITY_PUBLIC_FEEDS: 'off' });
    expect(enrichment.ipquery).toHaveBeenCalledWith('8.8.8.8');
    expect(result.signals.filter((signal) => signal.source === 'IPQuery')).toHaveLength(4);
    expect(result.signals).toContainEqual(
      expect.objectContaining({ key: 'vpn', value: true, source: 'IPQuery' }),
    );
    expect(result.signals).toContainEqual(
      expect.objectContaining({ key: 'proxy', value: false, source: 'IPQuery' }),
    );
    expect(result.feeds).toContainEqual(feed);
    expect(result.asnType).toMatchObject({ type: 'isp', inferred: true });
    expect(result.companyType).toMatchObject({ type: 'hosting', inferred: true });
  });

  it('retains local inferred VPN evidence and exposes an IPQuery outage independently', async () => {
    enrichment.network.mockResolvedValue({
      signals: [
        {
          key: 'vpn',
          value: true,
          source: 'X4B VPN ranges',
          confidence: 0.6,
          detection: 'Estimated / Unsupported',
        },
      ],
      feeds: [],
      warnings: [],
    });
    enrichment.ipquery.mockResolvedValue({
      signals: [],
      feeds: [
        {
          source: 'IPQuery',
          url: 'https://ipquery.io/',
          checked: false,
          updatedAt: null,
          status: 'unavailable',
        },
      ],
      warnings: ['IPQuery unavailable or invalid; checks remain unknown.'],
    });
    fixtures();
    const result = await collect();
    expect(result.signals).toContainEqual(
      expect.objectContaining({ key: 'vpn', value: true, source: 'X4B VPN ranges' }),
    );
    expect(result.signals.some((signal) => signal.source === 'IPQuery')).toBe(false);
    expect(result.feeds).toContainEqual(expect.objectContaining({ source: 'IPQuery', checked: false }));
    expect(result.warnings).toContain('IPQuery unavailable or invalid; checks remain unknown.');
  });

  it('retains contradictory local and default-provider VPN findings for model conflict handling', async () => {
    enrichment.network.mockResolvedValue({
      signals: [
        {
          key: 'vpn',
          value: true,
          source: 'X4B VPN ranges',
          confidence: 0.6,
          detection: 'Estimated / Unsupported',
        },
      ],
      feeds: [],
      warnings: [],
    });
    enrichment.ipquery.mockResolvedValue({
      signals: [
        { key: 'vpn', value: false, source: 'IPQuery', confidence: null, detection: 'Provider Detection' },
      ],
      feeds: [],
      warnings: [],
    });
    fixtures();
    const input = await collect('8.8.8.8', { GEO_FREE_PROVIDER: 'off', PURITY_PUBLIC_FEEDS: 'off' });
    expect(input.signals.filter((signal) => signal.key === 'vpn')).toHaveLength(2);
    const { calculatePurity } = await import('../src/lib/purity');
    const result = calculatePurity('8.8.8.8', input);
    expect(result.conflicts).toContain('vpn');
    expect(result.dimensions.find((factor) => factor.key === 'anonymity')?.evidence).toBe(
      'Anonymity detected',
    );
    expect(result.level).not.toBe('High purity');
  });
});

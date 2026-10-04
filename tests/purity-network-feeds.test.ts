import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ipaddr from 'ipaddr.js';
import vpnSnapshot from '../api/purity/data/vpn.json';
import cloudSnapshot from '../api/purity/data/google-cloud.json';

const now = Date.parse('2026-10-05T00:00:00Z');
const cloudRows = [
  ...Array.from({ length: 9 }, (_, offset) => ({
    ipv4Prefix: `34.10.${offset}.0/24`,
    service: 'Google Cloud',
  })),
  { ipv6Prefix: '2600:1900:1000::/44', service: 'Google Cloud' },
];
const vpn = Array.from({ length: 10 }, (_, offset) => `9.10.${offset}.0/24`).join('\n');
function mockFeed(overrides: { vpn?: string | Error | Response; cloud?: object | Error | Response } = {}) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();
    const body = url.includes('gstatic.com')
      ? (overrides.cloud ?? { creationTime: '2026-10-04T22:00:00.000000', prefixes: cloudRows })
      : (overrides.vpn ?? vpn);
    if (body instanceof Error) throw body;
    if (body instanceof Response) return body.clone();
    return new Response(typeof body === 'string' ? body : JSON.stringify(body));
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
async function collect(ip: string, refresh = true) {
  const { collectNetworkPurity } = await import('../api/purity/network-feeds');
  return collectNetworkPurity(ip, { refresh });
}

describe('local network prefix evidence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('emits inferred positive VPN membership without changing ASN or company type', async () => {
    const mock = mockFeed();
    const result = await collect('9.10.0.255');
    expect(result.signals).toEqual([
      {
        key: 'vpn',
        value: true,
        source: 'X4B VPN ranges',
        confidence: 0.6,
        detection: 'Estimated / Unsupported',
      },
    ]);
    expect(result.companyType).toBeUndefined();
    expect(result.asnType).toBeUndefined();
    expect(result.neighborhood).toBeUndefined();
    expect(mock.mock.calls.every(([url]) => !url.toString().includes('9.10.0.255'))).toBe(true);
    expect(result.feeds).toContainEqual(
      expect.objectContaining({
        source: 'X4B VPN ranges',
        checked: true,
        updatedAt: null,
        fetchedAt: new Date(now).toISOString(),
        origin: 'live',
        status: 'available',
      }),
    );
  });

  it('keeps VPN and hosting unknown for misses, including Google DNS', async () => {
    mockFeed();
    const result = await collect('8.8.8.8');
    expect(result.signals).toEqual([]);
    expect(result.companyType).toBeUndefined();
  });

  it.each(['34.10.0.1', '2600:1900:100f:ffff::1'])(
    'classifies matched official Cloud prefix locally for %s',
    async (ip) => {
      mockFeed();
      const result = await collect(ip);
      expect(result.companyType).toEqual({
        type: 'hosting',
        source: 'Google Cloud public ranges',
        inferred: false,
      });
      expect(result.asnType).toBeUndefined();
      expect(result.signals).toContainEqual(
        expect.objectContaining({ key: 'hosting', value: true, confidence: 1 }),
      );
      expect(result.signals?.some((signal) => signal.key === 'abuse')).toBe(false);
      expect(result.feeds).toContainEqual(expect.objectContaining({ updatedAt: '2026-10-04T22:00:00.000Z' }));
    },
  );

  it('does not query the IPv4-only VPN feed for IPv6', async () => {
    const mock = mockFeed();
    const result = await collect('2606:4700:4700::1111');
    expect(result.signals).toEqual([]);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0].toString()).toContain('gstatic.com');
  });

  it('handles exact CIDR boundaries without matching the next address', async () => {
    mockFeed();
    expect((await collect('9.10.0.0')).signals).toContainEqual(
      expect.objectContaining({ key: 'vpn', value: true }),
    );
    expect((await collect('9.10.9.255')).signals).toContainEqual(
      expect.objectContaining({ key: 'vpn', value: true }),
    );
    expect((await collect('9.10.10.0')).signals).toEqual([]);
    expect((await collect('2600:1900:100f:ffff:ffff:ffff:ffff:ffff')).companyType?.type).toBe('hosting');
    expect((await collect('2600:1900:1010::')).companyType).toBeUndefined();
  });

  it('provides bundled offline VPN and dual-stack Cloud classifications without any request', async () => {
    const mock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', mock);
    const vpnIp = ipaddr.parseCIDR(vpnSnapshot.ranges[0])[0].toString();
    expect((await collect(vpnIp, false)).signals).toContainEqual(
      expect.objectContaining({ key: 'vpn', value: true }),
    );
    for (const cidr of ['34.1.208.0/20', '2600:1900:8000::/44']) {
      expect(cloudSnapshot.ranges).toContain(cidr);
      expect((await collect(ipaddr.parseCIDR(cidr)[0].toString(), false)).companyType?.type).toBe('hosting');
    }
    expect(mock).not.toHaveBeenCalled();
  });

  it('uses the precompiled bundled index on a cold query without parsing every CIDR', async () => {
    const parser = vi.spyOn(ipaddr, 'parseCIDR');
    const result = await collect('102.128.164.1', false);
    expect(result.signals).toContainEqual(expect.objectContaining({ key: 'vpn', value: true }));
    // publicIp validates a few fixed special-use ranges; dataset rows need no parsing.
    expect(parser.mock.calls.length).toBeLessThan(20);
  });

  it('normalizes live IPv4 rows without calling ipaddr CIDR parsing per dataset row', async () => {
    const parser = vi.spyOn(ipaddr, 'parseCIDR');
    mockFeed({
      vpn: Array.from(
        { length: 1000 },
        (_, offset) => `9.${Math.floor(offset / 256)}.${offset % 256}.7/24`,
      ).join('\n'),
    });
    const result = await collect('9.0.0.255');
    expect(result.signals).toContainEqual(expect.objectContaining({ key: 'vpn', value: true }));
    // Only fixed publicIp checks and the Cloud IPv6 row use ipaddr CIDR parsing.
    expect(parser.mock.calls.length).toBeLessThan(30);
  });

  it('uses a current bundled snapshot on outage and caches failed refresh', async () => {
    const mock = mockFeed({ vpn: new Error('offline'), cloud: new Error('offline') });
    const ip = ipaddr.parseCIDR(vpnSnapshot.ranges[0])[0].toString();
    const result = await collect(ip);
    expect(result.signals).toContainEqual(expect.objectContaining({ key: 'vpn', value: true }));
    expect(result.feeds).toContainEqual(
      expect.objectContaining({ source: 'X4B VPN ranges', origin: 'snapshot', status: 'available' }),
    );
    await collect(ip);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('never uses expired bundled classifications after failed refresh', async () => {
    vi.setSystemTime('2026-11-10T00:00:00Z');
    mockFeed({ vpn: new Error('offline'), cloud: new Error('offline') });
    const result = await collect('34.1.208.1');
    expect(result.companyType).toBeUndefined();
    expect(result.signals).toEqual([]);
    expect(result.feeds?.every((feed) => !feed.checked)).toBe(true);
    expect(result.feeds).toContainEqual(expect.objectContaining({ status: 'stale' }));
  });

  it.each([
    { vpn: '<html>oops</html>' },
    { vpn: '0.0.0.0/0\n' + vpn },
    { vpn: '2600:1900::/32\n' + vpn },
    { vpn: '9.999.0.0/24\n' + vpn },
    { vpn: '09.1.0.0/24\n' + vpn },
    { vpn: '9.1.0.0/033\n' + vpn },
    { cloud: { creationTime: '2026-01-01', prefixes: cloudRows } },
    { cloud: { creationTime: '2027-01-01', prefixes: cloudRows } },
    { cloud: { creationTime: '2026-10-04', prefixes: [{ ipv4Prefix: '34.10.0.0/24' }] } },
    { cloud: new Response('x', { headers: { 'content-length': '2000001' } }) },
  ])('rejects malformed, stale, future, broad, truncated or oversized feed %j', async (overrides) => {
    mockFeed(overrides);
    const result = await collect('9.10.0.1');
    expect(result.warnings?.some((warning) => warning.includes('refresh unavailable'))).toBe(true);
    const source = 'vpn' in overrides ? 'X4B VPN ranges' : 'Google Cloud public ranges';
    expect(result.feeds).toContainEqual(expect.objectContaining({ source, origin: 'snapshot' }));
  });

  it('coalesces simultaneous full dataset downloads and reuses results across target IPs', async () => {
    const mock = mockFeed();
    await Promise.all([collect('9.10.0.1'), collect('34.10.0.2'), collect('8.8.8.8')]);
    expect(mock).toHaveBeenCalledTimes(2);
    await collect('1.1.1.1');
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('rejects private and malformed targets before making any request', async () => {
    const mock = mockFeed();
    await expect(collect('127.0.0.1')).rejects.toThrow('Only public');
    await expect(collect('invalid')).rejects.toThrow('Only public');
    expect(mock).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ipaddr from 'ipaddr.js';
import vpn from '../api/purity/data/vpn.json';
import cloud from '../api/purity/data/google-cloud.json';
import { publicIp } from '../edge/core/security';

const start = Date.parse('2026-10-04T12:00:00Z');
type Address = ReturnType<typeof ipaddr.parse>;
type Range = ReturnType<typeof ipaddr.parseCIDR>;

function fromInteger(value: bigint, bits: number): string {
  const bytes = Array.from({ length: bits / 8 }, (_, offset) =>
    Number((value >> BigInt(bits - (offset + 1) * 8)) & 255n),
  );
  return ipaddr.fromByteArray(bytes).toString();
}

function boundarySamples(ranges: string[], limit: number): Set<string> {
  const samples = new Set<string>();
  for (let offset = 0; offset < limit; offset++) {
    const cidr = ranges[Math.floor((offset * ranges.length) / limit)];
    const [address, prefix] = ipaddr.parseCIDR(cidr);
    const bits = address.kind() === 'ipv4' ? 32 : 128;
    const first = address.toByteArray().reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
    const last = first + (1n << BigInt(bits - prefix)) - 1n;
    for (const value of [first - 1n, first, first + 1n, last - 1n, last, last + 1n]) {
      if (value < 0n || value >= 1n << BigInt(bits)) continue;
      const ip = fromInteger(value, bits);
      if (publicIp(ip)) samples.add(ip);
    }
  }
  return samples;
}

function reference(address: Address, ranges: Range[]): boolean {
  return ranges.some((range) => address.kind() === range[0].kind() && address.match(range));
}

async function collect(ip: string, refresh = false) {
  const { collectNetworkPurity } = await import('../api/purity/network-feeds');
  return collectNetworkPurity(ip, { refresh });
}

describe('release validation for local network datasets', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(start);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request')));
  });
  afterEach(() => {
    vi.doUnmock('../api/purity/data/vpn.json');
    vi.doUnmock('../api/purity/data/google-cloud.json');
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('matches independent ipaddr CIDR checks at sampled original prefix boundaries and seeded addresses', async () => {
    const vpnReference = vpn.ranges.map((cidr) => ipaddr.parseCIDR(cidr));
    const cloudReference = cloud.ranges.map((cidr) => ipaddr.parseCIDR(cidr));
    const samples = new Set([
      ...boundarySamples(vpn.ranges, 80),
      ...boundarySamples(
        cloud.ranges.filter((cidr) => !cidr.includes(':')),
        40,
      ),
      ...boundarySamples(
        cloud.ranges.filter((cidr) => cidr.includes(':')),
        40,
      ),
    ]);
    let seed = 0x19a442b1;
    for (let offset = 0; offset < 100; offset++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const ip = fromInteger(BigInt(seed), 32);
      if (publicIp(ip)) samples.add(ip);
    }
    expect(samples.size).toBeGreaterThan(700);
    for (const ip of samples) {
      const address = ipaddr.parse(ip);
      const result = await collect(ip);
      expect(
        result.signals?.some((signal) => signal.key === 'vpn' && signal.value === true),
        ip,
      ).toBe(reference(address, vpnReference));
      expect(result.companyType?.type === 'hosting', ip).toBe(reference(address, cloudReference));
    }
    expect(fetch).not.toHaveBeenCalled();
  }, 30000);

  it.each([
    { sha256: '0'.repeat(64) },
    { ranges: [] },
    { intervals4: [[1, 4294967295]] },
    { source: 'Another provider' },
    { verifiedAt: 'not-a-date' },
    { verifiedAt: '2026-10-05T12:00:00Z' },
  ])(
    'does not classify from corrupt, empty, incorrect-provenance or future snapshot %j',
    async (override) => {
      vi.doMock('../api/purity/data/vpn.json', () => ({ default: { ...vpn, ...override } }));
      const result = await collect('102.128.164.1');
      expect(result.signals?.some((signal) => signal.key === 'vpn')).toBe(false);
      expect(result.feeds).toContainEqual(
        expect.objectContaining({ source: 'X4B VPN ranges', checked: false }),
      );
    },
  );

  it('stops using VPN evidence at its exact expiry and keeps its original retrieval date', async () => {
    const expires = Date.parse(vpn.verifiedAt) + 7 * 86400_000;
    vi.setSystemTime(expires - 1);
    const valid = await collect('102.128.164.1');
    expect(valid.signals).toContainEqual(expect.objectContaining({ key: 'vpn', value: true }));
    vi.setSystemTime(expires);
    const expired = await collect('102.128.164.1');
    expect(expired.signals?.some((signal) => signal.key === 'vpn')).toBe(false);
    expect(expired.feeds).toContainEqual(
      expect.objectContaining({
        source: 'X4B VPN ranges',
        status: 'stale',
        fetchedAt: vpn.verifiedAt,
        expiresAt: new Date(expires).toISOString(),
      }),
    );
  });

  it('expires Cloud membership by publication time even when the later retrieval still falls within 30 days', async () => {
    const expires = Date.parse(cloud.publishedAt!) + 30 * 86400_000;
    vi.setSystemTime(expires - 1);
    expect((await collect('34.1.208.1')).companyType?.type).toBe('hosting');
    vi.setSystemTime(expires);
    const expired = await collect('34.1.208.1');
    expect(expired.companyType).toBeUndefined();
    expect(expired.feeds).toContainEqual(
      expect.objectContaining({
        source: 'Google Cloud public ranges',
        checked: false,
        status: 'stale',
        expiresAt: new Date(expires).toISOString(),
      }),
    );
  });

  it('retains valid live evidence on failed refresh without changing freshness and refreshes again after failure cooldown', async () => {
    const mock = vi.fn(async (url: RequestInfo | URL) => {
      if (url.toString().includes('gstatic'))
        return new Response(
          JSON.stringify({
            creationTime: new Date(start).toISOString(),
            prefixes: Array.from({ length: 10 }, (_, offset) => ({
              ipv4Prefix: `34.200.${offset}.0/24`,
              service: 'Google Cloud',
            })),
          }),
        );
      return new Response(Array.from({ length: 10 }, (_, offset) => `9.20.${offset}.0/24`).join('\n'));
    });
    vi.stubGlobal('fetch', mock);
    const first = await collect('9.20.0.1', true);
    expect(first.signals).toContainEqual(expect.objectContaining({ key: 'vpn', value: true }));
    expect(mock).toHaveBeenCalledTimes(2);
    vi.setSystemTime(start + 6 * 3600_000 + 1);
    mock.mockImplementation(async () => {
      throw new Error('offline');
    });
    const fallback = await collect('9.20.0.1', true);
    expect(fallback.signals).toContainEqual(expect.objectContaining({ key: 'vpn', value: true }));
    expect(fallback.feeds).toContainEqual(
      expect.objectContaining({
        source: 'X4B VPN ranges',
        origin: 'live',
        fetchedAt: new Date(start).toISOString(),
      }),
    );
    await collect('9.20.0.1', true);
    expect(mock).toHaveBeenCalledTimes(4);
    vi.setSystemTime(start + 7 * 3600_000 + 2);
    await collect('9.20.0.1', true);
    expect(mock).toHaveBeenCalledTimes(6);
  });

  it('matches original live CIDRs across /8 through /32 with host bits and unsigned IPv4 values', async () => {
    const rows = Array.from({ length: 25 }, (_, offset) => `${130 + offset}.173.91.231/${8 + offset}`);
    const ranges = rows.map((cidr) => ipaddr.parseCIDR(cidr));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        if (url.toString().includes('gstatic')) throw new Error('Cloud fixture unavailable');
        return new Response(rows.join('\n'));
      }),
    );
    for (const cidr of rows) {
      const first = ipaddr.IPv4.networkAddressFromCIDR(cidr);
      const last = ipaddr.IPv4.broadcastAddressFromCIDR(cidr);
      const after = last.toByteArray().reduce((value, byte) => value * 256 + byte, 0) + 1;
      for (const ip of [first.toString(), last.toString(), fromInteger(BigInt(after), 32)]) {
        const result = await collect(ip, true);
        expect(
          result.signals?.some((signal) => signal.key === 'vpn' && signal.value === true),
          ip,
        ).toBe(reference(ipaddr.parse(ip), ranges));
      }
    }
  });
});

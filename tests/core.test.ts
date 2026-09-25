import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  asnSchema,
  hostSchema,
  ipSchema,
  publicIp,
  validateAddresses,
  validateHost,
  validatePort,
} from '../edge/core/security';
import { calculateRisk } from '../src/lib/risk';
import { statistics } from '../src/lib/statistics';
import { resolvePublic, reverseName } from '../api/dns/service';
import { LocalEdgeProbeProvider } from '../api/ping/service';
import { localAdapter } from '../edge/local/adapter';
import { rtcVerdict } from '../src/services/webrtc';
describe('IP and hostname validation', () => {
  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('accepts public IP %s', (ip) => {
    expect(ipSchema.safeParse(ip).success).toBe(true);
    expect(publicIp(ip)).toBe(true);
  });
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.1.1',
    '192.168.1.1',
    '169.254.169.254',
    '168.63.129.16',
    '0.0.0.0',
    '100.64.1.1',
    '198.18.0.1',
    '192.0.2.2',
    '198.51.100.1',
    '203.0.113.1',
    '224.1.2.3',
    '255.255.255.255',
    '::1',
    '::',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '64:ff9b::7f00:1',
    '2001:db8::1',
    '2002:7f00:1::',
    '3fff::1',
  ])('blocks special/private %s', (ip) => expect(publicIp(ip)).toBe(false));
  it.each([
    '127.1',
    '2130706433',
    '0x7f000001',
    'http://example.com',
    'example.com:80',
    'example.com/path',
    'example.com;whoami',
    'a\r\nHost:evil',
    '-bad.example',
    'bad_.example',
    'localhost',
    'x.local',
    'x.internal',
  ])('rejects unsafe hostname %s', (host) => expect(() => validateHost(host)).toThrow());
  it('validates normal domain and ASN', () => {
    expect(hostSchema.parse('EXAMPLE.com')).toBe('example.com');
    expect(asnSchema.parse('AS13335')).toBe(13335);
    expect(() => asnSchema.parse('AS4294967296')).toThrow();
  });
  it('blocks mixed-family DNS rebinding answers', () => {
    expect(() => validateAddresses(['8.8.8.8', '::1'])).toThrow();
    expect(() => validateAddresses([])).toThrow();
  });
  it('limits ports and rejects coercion', () => {
    expect(validatePort(443)).toBe(443);
    expect(() => validatePort(4444)).toThrow();
    expect(() => validatePort('443')).toThrow();
    expect(validatePort(8443, '8443')).toBe(8443);
  });
  it('converts IPv4 and IPv6 PTR names', () => {
    expect(reverseName('8.8.4.4')).toBe('4.4.8.8.in-addr.arpa');
    expect(reverseName('::1')).toBe('1.' + '0.'.repeat(31) + 'ip6.arpa');
  });
});
describe('risk evidence', () => {
  it('never calls missing data safe', () => {
    const r = calculateRisk('8.8.8.8', []);
    expect(r.score).toBeNull();
    expect(r.level).toBe('Not checked');
  });
  it('weights and deduplicates conflicting sources', () => {
    const r = calculateRisk('8.8.8.8', [
      { key: 'vpn', value: true, source: 'A', confidence: null, detection: 'Provider Detection' },
      { key: 'vpn', value: false, source: 'B', confidence: 0.8, detection: 'Provider Detection' },
      { key: 'abuse', value: 0.5, source: 'C', confidence: null, detection: 'Provider Detection' },
    ]);
    expect(r.score).toBe(35);
    expect(r.conflicts).toEqual(['vpn']);
    expect(r.checked).toBe(2);
    expect(r.partial).toBe(true);
  });
  it('zero findings preserve partial coverage', () => {
    const r = calculateRisk('1.1.1.1', [
      { key: 'vpn', value: false, source: 'A', confidence: null, detection: 'Provider Detection' },
    ]);
    expect(r.score).toBe(0);
    expect(r.partial).toBe(true);
  });
});
describe('latency statistics', () => {
  it('calculates requested sample statistics', () =>
    expect(statistics([20, 22, 25, 21, 32])).toEqual({
      min: 20,
      max: 32,
      average: 24,
      median: 22,
      p95: 32,
      jitter: 5,
    }));
  it('handles empty, invalid, and even samples', () => {
    expect(statistics([])).toBeNull();
    expect(statistics([NaN, -1])).toBeNull();
    expect(statistics([1, 3])?.median).toBe(2);
    expect(statistics([5])?.jitter).toBe(0);
  });
});
describe('SSRF transport behavior', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not connect if any DNS address is private', async () => {
    const connect = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: URL) =>
          new Response(
            JSON.stringify({
              Status: 0,
              Answer: [
                {
                  name: 'evil.example',
                  type: url.searchParams.get('type') === 'A' ? 1 : 28,
                  TTL: 0,
                  data: url.searchParams.get('type') === 'A' ? '8.8.8.8' : '::1',
                },
              ],
            }),
          ),
      ),
    );
    const p = new LocalEdgeProbeProvider({ ...localAdapter(), tcp: connect }, {});
    await expect(p.tcpPing('evil.example', 443)).rejects.toThrow();
    expect(connect).not.toHaveBeenCalled();
  });
  it('passes a pinned IP rather than hostname to the socket', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: URL) =>
          new Response(
            JSON.stringify({
              Status: 0,
              Answer:
                url.searchParams.get('type') === 'A'
                  ? [{ name: 'example.com', type: 1, TTL: 1, data: '8.8.8.8' }]
                  : [],
            }),
          ),
      ),
    );
    const tcp = vi.fn(async () => 5);
    const p = new LocalEdgeProbeProvider({ ...localAdapter(), tcp }, {});
    await p.tcpPing('example.com', 443);
    expect(tcp).toHaveBeenCalledWith('8.8.8.8', 443);
  });
  it('fails closed if one address family cannot be resolved', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        if (url.searchParams.get('type') === 'AAAA') throw new Error('network');
        return new Response(
          JSON.stringify({ Status: 0, Answer: [{ name: 'example.com', type: 1, TTL: 0, data: '8.8.8.8' }] }),
        );
      }),
    );
    await expect(resolvePublic('example.com', {})).rejects.toThrow();
  });
  it('does not follow HTTP redirects or return bodies', async () => {
    const fetch = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }),
    );
    vi.stubGlobal('fetch', fetch);
    const p = new LocalEdgeProbeProvider(localAdapter(), {});
    const r = await p.httpPing('8.8.8.8', 'http');
    expect(r.status).toBe(302);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toBeDefined();
  });
});
describe('WebRTC evidence', () => {
  it('does not call an empty candidate list no leak', () =>
    expect(rtcVerdict([], '8.8.8.8').verdict).toBe('Unable to determine'));
  it('compares normalized same-family addresses', () =>
    expect(
      rtcVerdict(
        [{ type: 'srflx', address: '2001:4860:4860:0:0:0:0:8888', protocol: 'udp', port: 1 }],
        '2001:4860:4860::8888',
      ).verdict,
    ).toBe('No obvious leak detected'));
  it('reports potential mismatch', () =>
    expect(
      rtcVerdict([{ type: 'srflx', address: '1.1.1.1', protocol: 'udp', port: 1 }], '8.8.8.8').verdict,
    ).toBe('Potential leak detected'));
  it('does not mistake dual-stack for a leak', () =>
    expect(
      rtcVerdict([{ type: 'srflx', address: '2001:4860:4860::8888', protocol: 'udp', port: 1 }], '8.8.8.8')
        .verdict,
    ).toBe('Unable to determine'));
});

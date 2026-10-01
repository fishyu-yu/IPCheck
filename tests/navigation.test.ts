import { describe, expect, it } from 'vitest';
import type { Health } from '../src/services/api';
import { isToolAvailable } from '../src/hooks/useVisibleNavigation';

const health: Health = {
  status: 'operational',
  platform: 'Test',
  capabilities: {
    geo: false,
    httpProbe: true,
    tcpSocket: false,
    icmp: false,
    traceroute: false,
    dnsCollector: false,
    kv: false,
  },
  providers: { geo: true, risk: false, remoteProbe: false },
  rateLimit: 'Test',
};
describe('visible runtime tools', () => {
  it('keeps core and browser tools visible while capabilities are loading', () => {
    for (const key of ['overview', 'ip', 'asn', 'dns', 'latency', 'environment', 'fingerprint', 'webrtc'])
      expect(isToolAvailable(key)).toBe(true);
    for (const key of ['risk', 'ping', 'tcp']) expect(isToolAvailable(key)).toBe(false);
  });
  it('hides risk without a provider and shows it when configured', () => {
    expect(isToolAvailable('risk', health)).toBe(false);
    expect(isToolAvailable('risk', { ...health, providers: { ...health.providers, risk: true } })).toBe(true);
  });
  it('shows native HTTP without advertising unsupported sockets', () => {
    expect(isToolAvailable('ping', health)).toBe(true);
    expect(isToolAvailable('tcp', health)).toBe(false);
    expect(
      isToolAvailable('tcp', { ...health, capabilities: { ...health.capabilities, tcpSocket: true } }),
    ).toBe(true);
  });
  it('supports an enabled remote probe but hides a configured probe when active tests are disabled', () => {
    const remote = {
      ...health,
      providers: { ...health.providers, remoteProbe: true },
      capabilities: { ...health.capabilities, httpProbe: false, icmp: true },
    };
    expect(isToolAvailable('ping', remote)).toBe(true);
    expect(isToolAvailable('tcp', remote)).toBe(true);
    const disabled = { ...remote, capabilities: { ...remote.capabilities, icmp: false } };
    expect(isToolAvailable('ping', disabled)).toBe(false);
    expect(isToolAvailable('tcp', disabled)).toBe(false);
  });
});

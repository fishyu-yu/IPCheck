import { describe, it, expect } from 'vitest';
import { getClientIp, isValidIp, isPrivateIp } from './ip-helper';

describe('isValidIp', () => {
  it('validates IPv4 correctly', () => {
    expect(isValidIp('1.1.1.1')).toBe(true);
    expect(isValidIp('192.168.0.1')).toBe(true);
    expect(isValidIp('256.0.0.1')).toBe(false);
    expect(isValidIp('1.2.3')).toBe(false);
  });

  it('validates IPv6 correctly', () => {
    expect(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    expect(isValidIp('::1')).toBe(true);
    expect(isValidIp('2001:db8::')).toBe(true);
    expect(isValidIp('g:0:0:0:0:0:0:1')).toBe(false);
  });
});

describe('isPrivateIp', () => {
  it('identifies private IPv4 addresses', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });

  it('identifies private IPv6 addresses', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false);
  });
});

describe('getClientIp', () => {
  it('prioritizes Cloudflare headers', () => {
    const req = {
      headers: new Map([
        ['cf-connecting-ip', '1.1.1.1'],
        ['x-forwarded-for', '2.2.2.2'],
      ])
    } as unknown as Request;
    expect(getClientIp(req)).toBe('1.1.1.1');
  });

  it('falls back to X-Forwarded-For', () => {
    const req = {
      headers: new Map([
        ['x-forwarded-for', '3.3.3.3, 4.4.4.4'],
      ])
    } as unknown as Request;
    expect(getClientIp(req)).toBe('3.3.3.3');
  });

  it('skips private IPs in X-Forwarded-For', () => {
    const req = {
      headers: new Map([
        ['x-forwarded-for', '192.168.1.1, 5.5.5.5'],
      ])
    } as unknown as Request;
    expect(getClientIp(req)).toBe('5.5.5.5');
  });

  it('handles AliCDN headers', () => {
    const req = {
      headers: new Map([
        ['ali-cdn-real-ip', '6.6.6.6'],
      ])
    } as unknown as Request;
    expect(getClientIp(req)).toBe('6.6.6.6');
  });
});

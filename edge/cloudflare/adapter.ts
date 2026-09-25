import { connect } from 'cloudflare:sockets';
import type { EdgeContext } from '../../src/types';
import type { PlatformAdapter } from '../core/contracts';
import { publicIp, ApiError } from '../core/security';
import { pinnedHttp } from '../../api/ping/service';
interface CfRequest extends Request {
  cf?: {
    colo?: string;
    city?: string;
    region?: string;
    country?: string;
    asn?: number;
    timezone?: string;
    asOrganization?: string;
    latitude?: string;
    longitude?: string;
  };
}
export const cloudflareAdapter: PlatformAdapter = {
  name: 'Cloudflare',
  capabilities: {
    geo: true,
    tcpSocket: true,
    httpProbe: true,
    kv: false,
    icmp: false,
    traceroute: false,
    dnsCollector: false,
  },
  clientIp(request) {
    return request.headers.get('cf-connecting-ip');
  },
  context(request): EdgeContext {
    const cf = (request as CfRequest).cf;
    return {
      provider: 'Cloudflare',
      colo: cf?.colo,
      city: cf?.city,
      region: cf?.region,
      country: cf?.country,
      asn: cf?.asn,
      timezone: cf?.timezone,
      organization: cf?.asOrganization,
      latitude: cf?.latitude ? Number(cf.latitude) : undefined,
      longitude: cf?.longitude ? Number(cf.longitude) : undefined,
    };
  },
  async tcp(ip, port) {
    if (!publicIp(ip)) throw new ApiError('BLOCKED_TARGET', 'Public address required');
    const start = performance.now();
    const socket = connect({ hostname: ip, port });
    let timer: ReturnType<typeof setTimeout> | undefined;
    void socket.closed.catch(() => {});
    try {
      await Promise.race([
        socket.opened,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new ApiError('TIMEOUT', 'TCP connection timed out', 504)), 4000);
        }),
      ]);
      return performance.now() - start;
    } finally {
      clearTimeout(timer);
      await socket.close().catch(() => {});
    }
  },
  async http(ip, host, protocol) {
    if (!publicIp(ip)) throw new ApiError('BLOCKED_TARGET', 'Public address required');
    if (protocol === 'https') return pinnedHttp(ip, host, protocol);
    // Raw HTTP HEAD over a pinned socket preserves virtual hosting without a second DNS resolution.
    const start = performance.now();
    const socket = connect({ hostname: ip, port: 80 });
    void socket.closed.catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    const operation = async () => {
      await socket.opened;
      const writer = socket.writable.getWriter();
      await writer.write(
        new TextEncoder().encode(
          `HEAD / HTTP/1.1\r\nHost: ${host.includes(':') ? '[' + host + ']' : host}\r\nConnection: close\r\nAccept: */*\r\n\r\n`,
        ),
      );
      writer.releaseLock();
      const reader = socket.readable.getReader();
      let headers = '';
      const decoder = new TextDecoder();
      try {
        while (!headers.includes('\r\n\r\n')) {
          const { done, value } = await reader.read();
          if (done) break;
          headers += decoder.decode(value, { stream: true });
          if (headers.length > 16384) throw new Error('Headers too large');
        }
      } finally {
        reader.releaseLock();
      }
      const match = headers.match(/^HTTP\/1\.[01] ([1-5]\d\d)/);
      if (!match) throw new Error('Invalid HTTP response');
      return {
        status: Number(match[1]),
        server: headers.match(/\r\nserver:\s*([^\r\n]+)/i)?.[1],
        totalTime: performance.now() - start,
      };
    };
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new ApiError('TIMEOUT', 'HTTP probe timed out', 504)), 4000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      await socket.close().catch(() => {});
    }
  },
};

import type { PlatformAdapter } from '../core/contracts';
import { pinnedHttp } from '../../api/ping/service';
export function localAdapter(ip?: string): PlatformAdapter {
  return {
    name: 'Local development',
    capabilities: {
      geo: false,
      tcpSocket: false,
      httpProbe: true,
      kv: false,
      icmp: false,
      traceroute: false,
      dnsCollector: false,
    },
    clientIp: () => ip || null,
    context: () => ({ provider: 'Local development' }),
    http: pinnedHttp,
  };
}

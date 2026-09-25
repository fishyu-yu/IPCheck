import { createApp } from '../../api/app';
import type { Env, PlatformAdapter } from '../core/contracts';
import { pinnedHttp } from '../../api/ping/service';
export interface EdgeOneContext {
  request: Request;
  env: Env;
  clientIp?: string;
  geo?: {
    asn?: number;
    countryCodeAlpha2?: string;
    regionName?: string;
    cityName?: string;
    latitude?: number;
    longitude?: number;
  };
}
export function onRequest(context: EdgeOneContext) {
  const adapter: PlatformAdapter = {
    name: 'EdgeOne',
    capabilities: {
      geo: !!context.geo,
      tcpSocket: false,
      httpProbe: true,
      kv: false,
      icmp: false,
      traceroute: false,
      dnsCollector: false,
    },
    // Do not trust forwarded headers. The platform's context owns client identity.
    clientIp: () => context.clientIp || null,
    context: () => ({
      provider: 'EdgeOne',
      country: context.geo?.countryCodeAlpha2,
      region: context.geo?.regionName,
      city: context.geo?.cityName,
      asn: context.geo?.asn,
      latitude: context.geo?.latitude,
      longitude: context.geo?.longitude,
    }),
    http: pinnedHttp,
  };
  return createApp(adapter).fetch(context.request, context.env || {});
}

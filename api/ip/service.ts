import type { IPInfo } from '../../src/types';
import type { Env, PlatformAdapter, GeoProvider } from '../../edge/core/contracts';
import { geoProviders } from '../lookup/providers';
import { ipSchema, publicIp } from '../../edge/core/security';
import { cached } from '../../edge/core/cache';
export async function lookupIp(
  ip: string,
  env: Env,
  providers: GeoProvider[] = geoProviders(env),
): Promise<IPInfo> {
  ipSchema.parse(ip);
  const info: IPInfo = {
    ip,
    version: ip.includes(':') ? 6 : 4,
    type: [],
    sources: [],
    fieldSources: {},
    partial: true,
    warnings: [],
    detection: 'Provider Detection',
  };
  if (!publicIp(ip)) {
    info.warnings.push('Non-public address: geolocation and risk providers were not contacted');
    return info;
  }
  for (const provider of providers) {
    try {
      const data = await provider.lookup(ip);
      Object.assign(info, data);
      info.sources.push(provider.name);
      for (const [key, value] of Object.entries(data))
        if (value !== undefined) info.fieldSources![key] = provider.name;
      return info;
    } catch {
      info.warnings.push(provider.name + ' unavailable; trying next provider');
    }
  }
  info.warnings.push('No geolocation provider returned data');
  return info;
}
export async function currentIp(request: Request, env: Env, adapter: PlatformAdapter): Promise<IPInfo> {
  const raw = adapter.clientIp(request);
  const ip = raw && ipSchema.safeParse(raw).success && publicIp(raw) ? raw : null;
  const edge = adapter.context(request);
  const info: IPInfo = ip
    ? structuredClone(
        await cached(
          'geo:' + ip,
          86400,
          () => lookupIp(ip, env),
          (x) => x.sources.length > 0,
        ),
      )
    : {
        ip: null,
        version: null,
        type: [],
        sources: [],
        fieldSources: {},
        partial: true,
        warnings: [
          'Public client IP is unavailable in this local runtime. Deploy to an edge platform or set DEV_PUBLIC_IP for development.',
        ],
        detection: 'Estimated / Unsupported',
      };
  // Request metadata belongs only to the visitor, never to an arbitrary lookup target.
  for (const key of ['city', 'region', 'asn', 'timezone', 'organization', 'latitude', 'longitude'] as const) {
    const value = edge[key];
    if (value !== undefined && info[key] === undefined) {
      Object.assign(info, { [key]: value });
      info.fieldSources![key] = adapter.name + ' request metadata';
    }
  }
  if (edge.country && !info.countryCode) {
    info.countryCode = edge.country;
    info.fieldSources!.countryCode = adapter.name + ' request metadata';
  }
  if (ip) info.sources.push(adapter.name + ' client address');
  if (ip && adapter.name === 'Local development')
    info.warnings.push(
      'DEV_PUBLIC_IP is an explicitly configured development address, not an automatically detected visitor address.',
    );
  return {
    ...info,
    edge,
    userAgent: request.headers.get('user-agent') || 'Unknown',
    detection: ip && adapter.name !== 'Local development' ? 'Real Detection' : 'Estimated / Unsupported',
  };
}

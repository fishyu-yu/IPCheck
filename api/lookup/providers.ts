import { z } from 'zod';
import type { GeoProvider, Env, ASNProvider } from '../../edge/core/contracts';
import type { IPInfo, ASNInfo, IPType } from '../../src/types';
import { fetchJson } from '../../edge/core/security';
const optionalString = z
  .string()
  .nullish()
  .transform((v) => v || undefined);
const whoSchema = z.object({
  success: z.boolean(),
  country: optionalString,
  country_code: optionalString,
  region: optionalString,
  city: optionalString,
  postal: optionalString,
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  connection: z.object({ asn: z.number().optional(), org: optionalString, isp: optionalString }).optional(),
  timezone: z.object({ id: optionalString }).optional(),
});
export class IpWhoProvider implements GeoProvider {
  name = 'ipwho.is';
  async lookup(ip: string): Promise<Partial<IPInfo>> {
    const d = whoSchema.parse(await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`));
    if (!d.success) throw new Error('Geo lookup unavailable');
    return {
      country: d.country,
      countryCode: d.country_code,
      region: d.region,
      city: d.city,
      postal: d.postal,
      latitude: d.latitude,
      longitude: d.longitude,
      timezone: d.timezone?.id,
      asn: d.connection?.asn,
      organization: d.connection?.org,
      isp: d.connection?.isp,
    };
  }
}
export class IpInfoProvider implements GeoProvider {
  name = 'IPinfo';
  constructor(private token: string) {}
  async lookup(ip: string): Promise<Partial<IPInfo>> {
    const schema = z.object({
      geo: z
        .object({
          country: optionalString,
          country_code: optionalString,
          region: optionalString,
          city: optionalString,
          postal_code: optionalString,
          timezone: optionalString,
          latitude: z.number().optional(),
          longitude: z.number().optional(),
        })
        .optional(),
      as: z
        .object({
          asn: z.string().regex(/^AS\d+$/),
          name: optionalString,
          type: optionalString,
          route: optionalString,
        })
        .optional(),
      is_mobile: z.boolean().optional(),
      is_hosting: z.boolean().optional(),
    });
    const d = schema.parse(
      await fetchJson(`https://api.ipinfo.io/lookup/${encodeURIComponent(ip)}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      }),
    );
    if (!d.geo && !d.as) throw new Error('Geo lookup unavailable or API plan unsupported');
    const types: Record<string, IPType> = {
      hosting: 'Datacenter',
      business: 'Business',
      education: 'Education',
      government: 'Government',
    };
    // An ISP ASN alone does not establish a residential connection.
    const value: IPType = d.is_mobile
      ? 'Mobile'
      : d.is_hosting
        ? 'Datacenter'
        : types[d.as?.type || ''] || 'Unknown';
    return {
      country: d.geo?.country,
      countryCode: d.geo?.country_code,
      region: d.geo?.region,
      city: d.geo?.city,
      postal: d.geo?.postal_code,
      timezone: d.geo?.timezone,
      organization: d.as?.name,
      asnName: d.as?.name,
      asn: d.as ? Number(d.as.asn.slice(2)) : undefined,
      prefix: d.as?.route,
      latitude: d.geo?.latitude,
      longitude: d.geo?.longitude,
      hostingProvider: d.is_hosting ? d.as?.name : undefined,
      type: [{ value, source: this.name, confidence: null, detection: 'Provider Detection' }],
    };
  }
}
export function geoProviders(env: Env): GeoProvider[] {
  return [
    ...(env.IPINFO_TOKEN ? [new IpInfoProvider(env.IPINFO_TOKEN)] : []),
    ...(env.GEO_FREE_PROVIDER === 'off' ? [] : [new IpWhoProvider()]),
  ];
}
export class RipeASNProvider implements ASNProvider {
  name = 'RIPEstat';
  async lookup(asn: number): Promise<ASNInfo> {
    const results = await Promise.allSettled([
      fetchJson(`https://stat.ripe.net/data/as-overview/data.json?resource=AS${asn}`),
      fetchJson(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`),
      fetchJson(`https://stat.ripe.net/data/rir/data.json?resource=AS${asn}`),
    ]);
    const info: ASNInfo = {
      asn,
      organization: null,
      country: null,
      rir: null,
      prefixCount: null,
      ipv4: [],
      ipv6: [],
      upstreams: null,
      source: this.name,
      partial: true,
      warnings: [],
    };
    try {
      if (results[0].status === 'fulfilled')
        info.organization = z
          .object({ data: z.object({ holder: z.string().nullable() }) })
          .parse(results[0].value).data.holder;
    } catch {
      info.warnings.push('Organization data unavailable');
    }
    try {
      if (results[1].status === 'fulfilled') {
        const p = z
          .object({ data: z.object({ prefixes: z.array(z.object({ prefix: z.string() })) }) })
          .parse(results[1].value).data.prefixes;
        info.ipv4 = p.map((x) => x.prefix).filter((p) => !p.includes(':'));
        info.ipv6 = p.map((x) => x.prefix).filter((p) => p.includes(':'));
        info.prefixCount = p.length;
      }
    } catch {
      info.warnings.push('Prefix data unavailable');
    }
    try {
      if (results[2].status === 'fulfilled')
        info.rir =
          z
            .object({ data: z.object({ rirs: z.array(z.object({ rir: z.string() })) }) })
            .parse(results[2].value)
            .data.rirs.map((r) => r.rir)
            .join(', ') || null;
    } catch {
      info.warnings.push('Registry data unavailable');
    }
    results.forEach((r, i) => {
      if (r.status === 'rejected')
        info.warnings.push(['Overview', 'Prefixes', 'Registry'][i] + ' provider unavailable');
    });
    return info;
  }
}

import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { useCurrentIp, useRisk } from '../hooks/queries';
import type { ASNInfo, IPInfo, RiskResult } from '../types';
import {
  Badge,
  Card,
  CopyButton,
  DataList,
  DetectionBadge,
  Empty,
  Notice,
  PageTitle,
  RunButton,
  Skeleton,
} from '../components/ui';
import { RiskPanel } from '../components/RiskPanel';
export default function Intelligence({ kind }: { kind: 'ip' | 'asn' | 'risk' }) {
  const current = useCurrentIp();
  const risk = useRisk(kind === 'risk' ? current.data?.ip : null);
  const [input, setInput] = useState('');
  const lookup = useMutation({
    mutationFn: () => api<IPInfo | ASNInfo | RiskResult>(`/api/${kind}/${encodeURIComponent(input.trim())}`),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    lookup.mutate();
  };
  const data = lookup.data || (kind === 'ip' ? current.data : kind === 'risk' ? risk.data : undefined);
  const ip = kind === 'ip' ? (data as IPInfo | undefined) : undefined,
    asn = kind === 'asn' ? (data as ASNInfo | undefined) : undefined;
  return (
    <>
      <PageTitle
        eyebrow="IP INTELLIGENCE"
        title={{ ip: 'IP Lookup', asn: 'ASN Lookup', risk: 'Risk Analysis' }[kind]}
        description={
          {
            ip: 'Geography, network ownership, and the evidence behind each result.',
            asn: 'Explore an autonomous system and its announced networks.',
            risk: 'A transparent risk model. Missing evidence is never treated as safe.',
          }[kind]
        }
      />
      <form className="tool-form card" onSubmit={submit}>
        <label htmlFor="lookup">{kind === 'asn' ? 'Autonomous system' : 'IPv4 / IPv6 address'}</label>
        <div className="input-row">
          <div className="input-icon">
            <Search size={17} />
            <input
              id="lookup"
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={kind === 'asn' ? 'AS13335' : 'Enter IPv4 / IPv6'}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <RunButton busy={lookup.isPending}>Look up</RunButton>
        </div>
        <p className="helper">
          {kind === 'asn'
            ? 'Source: RIPEstat. Prefixes reflect observed BGP announcements.'
            : 'Queries are sent to configured providers. Results can be incomplete or differ between sources.'}
        </p>
      </form>
      {lookup.error && <Notice error>{lookup.error.message}</Notice>}
      {lookup.isPending && <Skeleton lines={5} />}
      {kind === 'risk' && <RiskPanel data={data as RiskResult | undefined} />}
      {ip && (
        <>
          <div className="result-title">
            <h2 className="mono">{ip.ip || 'Current public IP unavailable'}</h2>
            {ip.ip && <CopyButton text={ip.ip} />}
            <DetectionBadge type={ip.detection} />
            {ip.partial && <Badge tone="yellow">Partial data</Badge>}
          </div>
          <div className="two-columns">
            <Card title="Basic information">
              <DataList
                data={{
                  IP: ip.ip,
                  'IP version': ip.version ? 'IPv' + ip.version : undefined,
                  Country: ip.country,
                  'Country code': ip.countryCode,
                  Region: ip.region,
                  City: ip.city,
                  'Postal code': ip.postal,
                  Latitude: ip.latitude,
                  Longitude: ip.longitude,
                  Timezone: ip.timezone,
                }}
              />
            </Card>
            <Card title="Network">
              <DataList
                data={{
                  ASN: ip.asn ? 'AS' + ip.asn : undefined,
                  'ASN name': ip.asnName,
                  Organization: ip.organization,
                  ISP: ip.isp,
                  'Network range / prefix': ip.prefix,
                  'Reverse DNS': ip.reverseDns,
                  'Hosting provider': ip.hostingProvider,
                  'IP type': ip.type.length
                    ? ip.type.map((v, i) => (
                        <div key={i}>
                          {v.value || 'Unknown'}
                          <small>
                            {v.source} · confidence {v.confidence === null ? 'Unknown' : v.confidence}
                          </small>
                        </div>
                      ))
                    : 'Unknown',
                  'Edge POP': ip.edge?.colo,
                  'User agent': ip.userAgent,
                }}
              />
            </Card>
          </div>
          <Card title="Sources & confidence">
            <p>
              Geolocation is an estimate from provider records, not precise device location. Unknown
              confidence means the provider supplied no confidence metric.
            </p>
            <DataList data={ip.fieldSources || {}} />
            <p className="helper">{ip.sources.join(' · ') || 'No provider data'}</p>
            {ip.warnings.map((w) => (
              <Notice key={w}>{w}</Notice>
            ))}
          </Card>
        </>
      )}
      {asn && (
        <>
          <div className="two-columns">
            <Card title={'AS' + asn.asn} action={<Badge tone="blue">Provider Detection</Badge>}>
              <DataList
                data={{
                  Organization: asn.organization,
                  Country: asn.country,
                  RIR: asn.rir,
                  'Prefix count': asn.prefixCount,
                  'Peering / upstream': asn.upstreams?.join(', '),
                  Source: asn.source,
                }}
              />
            </Card>
            <Card title="Data availability">
              <Notice>
                Prefixes are announcements observed by RIPE RIS, not a complete ownership inventory. Country
                and upstream information remain Unknown without a reliable provider.
              </Notice>
              {asn.warnings.map((w) => (
                <p className="helper" key={w}>
                  {w}
                </p>
              ))}
            </Card>
          </div>
          <div className="two-columns">
            {[
              ['IPv4 prefixes', asn.ipv4],
              ['IPv6 prefixes', asn.ipv6],
            ].map(([title, prefixes]) => (
              <Card key={String(title)} title={String(title)}>
                <div className="prefix-list">
                  {(prefixes as string[]).length ? (
                    (prefixes as string[]).map((p) => <code key={p}>{p}</code>)
                  ) : (
                    <p className="text-muted">No prefix data returned</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      {kind === 'asn' && !data && !lookup.isPending && (
        <Empty
          title="Explore a network"
          description="Enter an ASN to retrieve organization and prefix data from RIPEstat."
        />
      )}
    </>
  );
}

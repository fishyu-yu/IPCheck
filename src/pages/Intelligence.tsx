import { localize, countryName } from '../config/i18n';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { useCurrentIp, usePurity } from '../hooks/queries';
import type { ASNInfo, IPInfo, PurityResult } from '../types';
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
import { PurityPanel } from '../components/PurityPanel';
export default function Intelligence({ kind }: { kind: 'ip' | 'asn' | 'risk' }) {
  const current = useCurrentIp();
  const [params] = useSearchParams();
  const requestedIp = kind === 'risk' ? params.get('ip') : null;
  const currentPurity = usePurity(kind === 'risk' ? requestedIp || current.data?.ip : null);
  const [input, setInput] = useState(requestedIp || '');
  const lookup = useMutation({
    mutationFn: (target: string) =>
      api<IPInfo | ASNInfo | PurityResult>(
        `/api/${kind === 'risk' ? 'purity' : kind}/${encodeURIComponent(target)}`,
      ),
  });
  const resetLookup = lookup.reset;
  useEffect(() => {
    resetLookup();
    setInput(requestedIp || '');
  }, [kind, requestedIp, resetLookup]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    lookup.mutate(input.trim());
  };
  const hasLookup = lookup.variables !== undefined;
  const data = hasLookup
    ? lookup.isSuccess
      ? lookup.data
      : undefined
    : kind === 'ip'
      ? current.data
      : kind === 'risk'
        ? currentPurity.data
        : undefined;
  const ip = kind === 'ip' ? (data as IPInfo | undefined) : undefined,
    asn = kind === 'asn' ? (data as ASNInfo | undefined) : undefined;
  const ipPurity = usePurity(ip?.ip);
  const purityLoading =
    lookup.isPending || (!hasLookup && (currentPurity.isFetching || (!requestedIp && current.isLoading)));
  const purityError =
    lookup.error || (!hasLookup ? currentPurity.error || (!requestedIp ? current.error : null) : null);
  const retryPurity = () => {
    if (hasLookup) lookup.mutate(lookup.variables!);
    else if (requestedIp || current.data?.ip) void currentPurity.refetch();
    else void current.refetch();
  };
  return (
    <>
      <PageTitle
        eyebrow="IP INTELLIGENCE"
        title={localize({ ip: 'IP Lookup', asn: 'ASN Lookup', risk: 'IP Purity' }[kind])}
        description={
          {
            ip: 'Geography, network ownership, and the evidence behind each result.',
            asn: 'Explore an autonomous system and its announced networks.',
            risk: 'Network types, anonymity, abuse evidence, and neighborhood threats in one transparent local model.',
          }[kind]
        }
      />
      <form className="tool-form card" onSubmit={submit}>
        <label htmlFor="lookup">
          {localize(kind === 'asn' ? 'Autonomous system' : 'IPv4 / IPv6 address')}
        </label>
        <div className="input-row">
          <div className="input-icon">
            <Search size={17} />
            <input
              id="lookup"
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={localize(kind === 'asn' ? 'AS13335' : 'Enter IPv4 / IPv6')}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <RunButton busy={lookup.isPending}>{localize('Look up')}</RunButton>
        </div>
        <p className="helper">
          {localize(
            kind === 'asn'
              ? 'Source: RIPEstat. Prefixes reflect observed BGP announcements.'
              : 'Queries are sent to configured providers. Results can be incomplete or differ between sources.',
          )}
        </p>
      </form>
      {kind === 'asn' && lookup.error && <Notice error>{localize(lookup.error.message)}</Notice>}
      {kind !== 'risk' && lookup.isPending && <Skeleton lines={5} />}
      {kind === 'risk' && (
        <PurityPanel
          ip={hasLookup ? lookup.variables : requestedIp || current.data?.ip}
          data={data as PurityResult | undefined}
          loading={purityLoading}
          error={purityError}
          onRetry={retryPurity}
        />
      )}
      {kind === 'ip' && (
        <PurityPanel
          ip={ip?.ip}
          data={ipPurity.data}
          loading={lookup.isPending || (!hasLookup && current.isLoading) || ipPurity.isFetching}
          error={ipPurity.error || lookup.error || (!hasLookup ? current.error : null)}
          onRetry={() => {
            if (ip?.ip) void ipPurity.refetch();
            else if (hasLookup) lookup.mutate(lookup.variables!);
            else void current.refetch();
          }}
        />
      )}
      {ip && (
        <>
          <div className="result-title">
            <h2 className="mono">{localize(ip.ip || 'Current public IP unavailable')}</h2>
            {ip.ip && <CopyButton text={ip.ip} />}
            <DetectionBadge type={ip.detection} />
            {ip.partial && <Badge tone="yellow">{localize('Partial data')}</Badge>}
          </div>
          <div className="two-columns">
            <Card title={localize('Basic information')}>
              <DataList
                data={{
                  IP: ip.ip,
                  'IP version': ip.version ? 'IPv' + ip.version : undefined,
                  Country: countryName(ip.countryCode, ip.country),
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
            <Card title={localize('Network')}>
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
                          {localize(v.value === 'Mobile' ? 'Mobile network' : v.value || 'Unknown')}
                          <small>
                            {localize(v.source)}
                            {localize(' · confidence ')}
                            {localize(v.confidence === null ? 'Unknown' : v.confidence)}
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
          <Card title={localize('Sources & confidence')}>
            <p>
              {localize(
                ' Geolocation is an estimate from provider records, not precise device location. Unknown confidence means the provider supplied no confidence metric. ',
              )}
            </p>
            <DataList data={ip.fieldSources || {}} />
            <p className="helper">{localize(ip.sources.join(' · ') || 'No provider data')}</p>
            {ip.warnings.map((w) => (
              <Notice key={w}>{localize(w)}</Notice>
            ))}
          </Card>
        </>
      )}
      {asn && (
        <>
          <div className="two-columns">
            <Card
              title={localize('AS' + asn.asn)}
              action={<Badge tone="blue">{localize('Provider Detection')}</Badge>}
            >
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
            <Card title={localize('Data availability')}>
              <Notice>
                {localize(
                  ' Prefixes are announcements observed by RIPE RIS, not a complete ownership inventory. Country and upstream information remain Unknown without a reliable provider. ',
                )}
              </Notice>
              {asn.warnings.map((w) => (
                <p className="helper" key={w}>
                  {localize(w)}
                </p>
              ))}
            </Card>
          </div>
          <div className="two-columns">
            {[
              ['IPv4 prefixes', asn.ipv4],
              ['IPv6 prefixes', asn.ipv6],
            ].map(([title, prefixes]) => (
              <Card key={String(title)} title={localize(String(title))}>
                <div className="prefix-list">
                  {(prefixes as string[]).length ? (
                    (prefixes as string[]).map((p) => <code key={p}>{localize(p)}</code>)
                  ) : (
                    <p className="text-muted">{localize('No prefix data returned')}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      {kind === 'asn' && !data && !lookup.isPending && (
        <Empty
          title={localize('Explore a network')}
          description="Enter an ASN to retrieve organization and prefix data from RIPEstat."
        />
      )}
    </>
  );
}

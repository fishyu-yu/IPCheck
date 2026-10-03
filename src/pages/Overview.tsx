import { localize, countryName } from '../config/i18n';
import { Activity, ArrowRight, Check, Globe2, MapPin, Monitor, Network, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentIp, useHealth, useRisk } from '../hooks/queries';
import {
  Badge,
  Card,
  CopyButton,
  DataList,
  DetectionBadge,
  Notice,
  PageTitle,
  Skeleton,
} from '../components/ui';
import { RiskPanel } from '../components/RiskPanel';
import { LatencyChart } from '../components/LatencyChart';
import { useLatency } from '../hooks/useLatency';
import { statistics } from '../lib/statistics';
import { PixelAddress } from '../components/PixelAddress';
import { LocationGlobe } from '../components/LocationGlobe';
export default function Overview() {
  const health = useHealth();
  const showRisk = health.data?.providers.risk === true;
  const query = useCurrentIp(),
    info = query.data,
    risk = useRisk(showRisk ? info?.ip : undefined);
  const latency = useLatency();
  const stats = statistics(latency.samples);
  const location = [
    info?.city,
    info?.country || info?.countryCode ? countryName(info.countryCode, info.country) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <>
      <PageTitle
        title={localize('Your network, in focus.')}
        description="A clear view of your connection, performance, and privacy."
        action={
          <button className="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
            <RefreshCw size={14} className={query.isFetching ? 'spin' : ''} />
            {localize(' Refresh analysis ')}
          </button>
        }
      />
      <div className="overview-focus">
      <section className="ip-hero" aria-label={localize('YOUR PUBLIC IP')}>
        <div className="ip-hero-content">
          <div className="hero-label">
            <span className="live-dot" />
            {localize(' YOUR PUBLIC IP')}
            {localize(' ')}
            <Badge>{localize(info?.version ? 'IPv' + info.version : 'AWAITING EDGE')}</Badge>
          </div>
          {query.isLoading ? (
            <Skeleton lines={1} />
          ) : (
            <div className="ip-line">
              {info?.ip ? (
                <PixelAddress value={info.ip} />
              ) : (
                <strong className="ip-unavailable">{localize('Not available locally')}</strong>
              )}
            </div>
          )}
          {info?.ip && (
            <div className="ip-meta">
              <span>
                <MapPin size={14} />
                {localize(location || 'Location unknown')}
              </span>
              <span>
                <Network size={14} />
                {localize(info?.asn ? 'AS' + info.asn : 'ASN unknown')}
              </span>
              <span>
                <Globe2 size={14} />
                {localize(info?.organization || 'Network unknown')}
              </span>
            </div>
          )}
          {info?.ip && (
            <div className="hero-source">
              <DetectionBadge type={info?.detection || 'Estimated / Unsupported'} />
              <span>
                {localize(info?.sources.join(' · ') || 'Connect through a supported edge deployment')}
              </span>
            </div>
          )}
          {info?.ip && (
            <div className="hero-copy">
              <CopyButton text={info.ip} />
            </div>
          )}
        </div>
      </section>
      <LocationGlobe ip={info?.ip} latitude={info?.latitude} longitude={info?.longitude} location={location} />
      </div>
      {query.error && <Notice error>{localize(query.error.message)}</Notice>}
      <div className="overview-grid">
        <Card
          title={localize('Network information')}
          subtitle="Your connection at a glance"
          action={<Badge tone="blue">{localize(info?.edge?.provider || 'Edge metadata')}</Badge>}
        >
          {query.isLoading ? (
            <Skeleton />
          ) : (
            <DataList
              data={{
                'IP address': info?.ip,
                'IP version': info?.version ? 'IPv' + info.version : undefined,
                'ISP / Organization': info?.isp || info?.organization,
                'Autonomous system': info?.asn ? 'AS' + info.asn : undefined,
                'Network type':
                  info?.type[0]?.value === 'Mobile' ? 'Mobile network' : info?.type[0]?.value || 'Unknown',
                'Edge POP': info?.edge?.colo || 'Unknown',
                Timezone: info?.timezone,
              }}
            />
          )}
          <Link className="card-link" to="/ip">
            {localize(' Explore IP intelligence ')}
            <ArrowRight size={14} />
          </Link>
        </Card>
        {showRisk && <RiskPanel compact data={risk.data} />}
        <Card
          title={localize('Connection latency')}
          subtitle="Your browser → current edge · HTTP round trip"
          action={
            <button className="button small" disabled={latency.busy} onClick={() => void latency.run()}>
              <Activity size={13} />
              {localize(latency.busy ? `${latency.samples.length} / 10` : 'Run test')}
            </button>
          }
        >
          <div className="latency-head">
            <strong>
              {localize(stats ? stats.average.toFixed(1) : '—')}
              <small>{localize(' ms')}</small>
            </strong>
            <Badge>{localize(stats ? 'Average RTT' : 'Not measured')}</Badge>
          </div>
          {latency.samples.length > 0 ? (
            <LatencyChart samples={latency.samples} />
          ) : (
            <p className="helper">{localize('Run a test to measure your connection')}</p>
          )}
          {latency.error && <Notice error>{localize(latency.error)}</Notice>}
          <div className="mini-stats">
            <span>
              {localize(' MIN ')}
              <b>{localize(stats ? stats.min.toFixed(1) + ' ms' : '—')}</b>
            </span>
            <span>
              {localize(' P95 ')}
              <b>{localize(stats ? stats.p95.toFixed(1) + ' ms' : '—')}</b>
            </span>
            <span>
              {localize(' JITTER ')}
              <b>{localize(stats ? stats.jitter.toFixed(1) + ' ms' : '—')}</b>
            </span>
          </div>
        </Card>
        <Card
          title={localize('Browser environment')}
          subtitle="What your browser shares"
          action={<Monitor size={17} className="text-muted" />}
        >
          <DataList
            data={{
              Platform: navigator.platform,
              Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              'CPU threads': navigator.hardwareConcurrency || 'Unsupported by browser',
            }}
          />
          <div className="privacy-note">
            <Check size={14} />
            <span>{localize('Collected locally. Never uploaded.')}</span>
          </div>
          <Link className="card-link" to="/environment">
            {localize(' View browser environment ')}
            <ArrowRight size={14} />
          </Link>
        </Card>
      </div>
      {info?.warnings.length ? <Notice>{localize(info.warnings.join(' · '))}</Notice> : null}
    </>
  );
}

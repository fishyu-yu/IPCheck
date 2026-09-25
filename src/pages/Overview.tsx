import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe2,
  LockKeyhole,
  MapPin,
  Monitor,
  Network,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentIp, useRisk } from '../hooks/queries';
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
export default function Overview() {
  const query = useCurrentIp(),
    info = query.data,
    risk = useRisk(info?.ip);
  const latency = useLatency();
  const stats = statistics(latency.samples);
  const location = [info?.city, info?.country || info?.countryCode].filter(Boolean).join(', ');
  return (
    <>
      <PageTitle
        title="Your network, in focus."
        description="A clear view of your connection, performance, and privacy."
        action={
          <button className="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
            <RefreshCw size={14} className={query.isFetching ? 'spin' : ''} /> Refresh analysis
          </button>
        }
      />
      <section className="ip-hero">
        <div className="ip-hero-content">
          <div className="hero-label">
            <span className="live-dot" /> YOUR PUBLIC IP{' '}
            <Badge>{info?.version ? 'IPv' + info.version : 'AWAITING EDGE'}</Badge>
          </div>
          {query.isLoading ? (
            <Skeleton lines={1} />
          ) : (
            <div className="ip-line">
              <strong className={!info?.ip ? 'ip-unavailable' : ''}>
                {info?.ip || 'Not available locally'}
              </strong>
              {info?.ip && <CopyButton text={info.ip} />}
            </div>
          )}
          <div className="ip-meta">
            <span>
              <MapPin size={14} />
              {location || 'Location unknown'}
            </span>
            <span>
              <Network size={14} />
              {info?.asn ? 'AS' + info.asn : 'ASN unknown'}
            </span>
            <span>
              <Globe2 size={14} />
              {info?.organization || 'Network unknown'}
            </span>
          </div>
          <div className="hero-source">
            <DetectionBadge type={info?.detection || 'Estimated / Unsupported'} />
            <span>{info?.sources.join(' · ') || 'Connect through a supported edge deployment'}</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <svg viewBox="0 0 260 190">
            <defs>
              <pattern id="grid" width="15" height="15" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r=".8" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="260" height="190" fill="url(#grid)" opacity=".2" />
            <g transform="translate(146 95)" fill="none" stroke="currentColor">
              <circle r="67" />
              <ellipse rx="33" ry="67" />
              <ellipse rx="56" ry="67" />
              <ellipse rx="67" ry="25" />
              <path d="M-67 0H67M0-67V67" />
              <circle r="84" strokeDasharray="2 9" opacity=".3" />
            </g>
            <circle cx="174" cy="63" r="5" className="globe-point" />
            <path d="M174 63L211 28H253" fill="none" stroke="var(--accent)" strokeDasharray="3 3" />
          </svg>
          <span>CONNECTED WORLD / 001</span>
        </div>
      </section>
      {query.error && <Notice error>{query.error.message}</Notice>}
      <div className="summary-grid">
        {[
          {
            icon: MapPin,
            label: 'Location',
            value: location || 'Unknown',
            detail: info?.timezone || 'Geolocation is approximate',
            url: '/ip',
            tag: 'GEO',
          },
          {
            icon: Network,
            label: 'Network',
            value: info?.organization || 'Unknown',
            detail: info?.asn ? 'AS' + info.asn : 'Waiting for network metadata',
            url: '/asn',
            tag: 'ASN',
          },
          {
            icon: ShieldCheck,
            label: 'Risk level',
            value: risk.data?.level || 'Not checked',
            detail:
              risk.data?.score !== null && risk.data?.score !== undefined
                ? `${risk.data.score} / 100 · ${risk.data.checked} signals checked`
                : 'Provider evidence required',
            url: '/risk',
            tag: 'RISK',
          },
          {
            icon: LockKeyhole,
            label: 'Privacy',
            value: 'Local-first',
            detail: 'Fingerprint stays in your browser',
            url: '/fingerprint',
            tag: 'BROWSER',
          },
        ].map((item) => (
          <Link className="summary-card" to={item.url} key={item.label}>
            <div className="summary-top">
              <span>
                <item.icon size={16} />
                {item.label}
              </span>
              <ArrowUpRight size={14} />
            </div>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
            <span className="summary-tag">{item.tag}</span>
          </Link>
        ))}
      </div>
      <div className="overview-grid">
        <Card
          title="Network information"
          subtitle="Your connection at a glance"
          action={<Badge tone="blue">{info?.edge?.provider || 'Edge metadata'}</Badge>}
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
                'Network type': info?.type[0]?.value || 'Unknown',
                'Edge POP': info?.edge?.colo || 'Unknown',
                Timezone: info?.timezone,
              }}
            />
          )}
          <Link className="card-link" to="/ip">
            Explore IP intelligence <ArrowRight size={14} />
          </Link>
        </Card>
        <RiskPanel compact data={risk.data} />
        <Card
          title="Connection latency"
          subtitle="Your browser → current edge · HTTP round trip"
          action={
            <button className="button small" disabled={latency.busy} onClick={() => void latency.run()}>
              <Activity size={13} />
              {latency.busy ? `${latency.samples.length} / 10` : 'Run test'}
            </button>
          }
        >
          <div className="latency-head">
            <strong>
              {stats ? stats.average.toFixed(1) : '—'}
              <small> ms</small>
            </strong>
            <Badge>{stats ? 'Average RTT' : 'Not measured'}</Badge>
          </div>
          <LatencyChart samples={latency.samples} />
          {latency.error && <Notice error>{latency.error}</Notice>}
          <div className="mini-stats">
            <span>
              MIN <b>{stats ? stats.min.toFixed(1) + ' ms' : '—'}</b>
            </span>
            <span>
              P95 <b>{stats ? stats.p95.toFixed(1) + ' ms' : '—'}</b>
            </span>
            <span>
              JITTER <b>{stats ? stats.jitter.toFixed(1) + ' ms' : '—'}</b>
            </span>
          </div>
        </Card>
        <Card
          title="Browser environment"
          subtitle="What your browser shares"
          action={<Monitor size={17} className="text-muted" />}
        >
          <DataList
            data={{
              Platform: navigator.platform,
              Language: navigator.language,
              Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              Screen: `${screen.width} × ${screen.height}`,
              'CPU threads': navigator.hardwareConcurrency || 'Unsupported by browser',
            }}
          />
          <div className="privacy-note">
            <Check size={14} />
            <span>Collected locally. Never uploaded.</span>
          </div>
          <Link className="card-link" to="/environment">
            View browser environment <ArrowRight size={14} />
          </Link>
        </Card>
      </div>
      {info?.warnings.length ? <Notice>{info.warnings.join(' · ')}</Notice> : null}
      <div className="bottom-note">
        <LockKeyhole size={14} />
        <span>No tracking scripts. No fabricated results. Every finding has a source.</span>
        <Link to="/tools">
          Explore all tools <ArrowRight size={13} />
        </Link>
      </div>
    </>
  );
}

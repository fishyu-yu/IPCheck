import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import ipaddr from 'ipaddr.js';
import { Link } from 'react-router-dom';
import { locale, localize } from '../config/i18n';
import type {
  NetworkCategory,
  PurityDimensionKey,
  PurityResult,
  PurityTypeEvidence,
  RiskKey,
  RiskSignal,
} from '../types';
import { Badge, Card, Notice } from './ui';

const dimensions: Record<PurityDimensionKey, string> = {
  asn: 'ASN network type',
  company: 'Company network type',
  anonymity: 'Anonymity evidence',
  abuse: 'Abuse and threat evidence',
  neighborhood: 'Neighborhood threat evidence',
};
const categories: Record<NetworkCategory, string> = {
  isp: 'ISP / access network',
  hosting: 'Hosting / datacenter',
  business: 'Business',
  education: 'Education',
  government: 'Government',
  unknown: 'Classification unavailable',
};
const confidenceLabels = {
  High: 'High evidence confidence',
  Medium: 'Medium evidence confidence',
  Low: 'Low evidence confidence',
};
const percent = (value: number) => `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
const signalLabels: Record<RiskKey, string> = {
  vpn: 'VPN',
  proxy: 'Proxy',
  tor: 'Tor',
  hosting: 'Hosting',
  datacenter: 'Datacenter',
  abuse: 'Abuse',
  bot: 'Bot',
  spam: 'Spam',
  blacklist: 'Blacklist',
  anonymous: 'Anonymous network',
};
function timestamp(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return localize('Timestamp not supplied');
  return new Date(value).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
}
function matchesIp(actual: string, requested?: string | null) {
  if (!requested) return true;
  try {
    return ipaddr.parse(actual).toString() === ipaddr.parse(requested.trim()).toString();
  } catch {
    return actual === requested.trim();
  }
}
function validSignalValue(signal: RiskSignal) {
  return (
    typeof signal.value === 'boolean' || (typeof signal.value === 'number' && Number.isFinite(signal.value))
  );
}
function SignalEvidence({ data }: { data?: PurityResult }) {
  return (
    <>
      <h3 className="purity-section-title">{localize('Individual source findings')}</h3>
      <p className="helper">
        {localize(
          'Negative findings apply only to the named source and its coverage. Unchecked signals remain unknown; inferred findings are not live measurements.',
        )}
      </p>
      <div className="purity-signals">
        {(Object.keys(signalLabels) as RiskKey[]).map((key) => {
          const findings = data?.signals.filter((signal) => signal.key === key) || [];
          const observed = findings.filter(validSignalValue);
          const conflicting =
            data?.conflicts.includes(key) || new Set(observed.map((signal) => Number(signal.value) > 0)).size > 1;
          return (
            <section
              className="purity-signal"
              key={key}
              data-signal-key={key}
              aria-label={localize(signalLabels[key])}
            >
              <div className="purity-signal-heading">
                <strong>{localize(signalLabels[key])}</strong>
                {conflicting && <Badge tone="yellow">{localize('Conflicting findings')}</Badge>}
              </div>
              <div className="purity-signal-findings">
                {(findings.length ? findings : [null]).map((finding, index) => {
                  const checked = finding && validSignalValue(finding);
                  const inferred = finding?.detection === 'Estimated / Unsupported';
                  const value = checked ? finding.value : null;
                  const positive = value !== null && Number(value) > 0;
                  const rawValue = typeof value === 'boolean' ? String(value) : value;
                  return (
                    <div className="purity-signal-finding" key={index}>
                      <div className="purity-signal-value">
                        <Badge tone={!checked ? 'muted' : positive ? 'yellow' : 'blue'}>
                          {value === null
                            ? `${localize('Unknown')} / ${localize('Not checked')}`
                            : typeof value === 'number'
                              ? `${rawValue} · ${percent(value)} ${localize('Evidence strength')}`
                              : `${rawValue} · ${localize(positive ? (inferred ? 'Inferred finding' : 'Detected') : 'Not detected in this source')}`}
                        </Badge>
                      </div>
                      <dl className="purity-signal-meta">
                        <div>
                          <dt>{localize('Source')}</dt>
                          <dd>{localize(finding?.source || 'Source unavailable')}</dd>
                        </div>
                        <div>
                          <dt>{localize('confidence')}</dt>
                          <dd>
                            {finding?.confidence !== null &&
                            finding?.confidence !== undefined &&
                            Number.isFinite(finding.confidence)
                              ? percent(finding.confidence)
                              : localize('Unknown')}
                          </dd>
                        </div>
                        <div>
                          <dt>{localize('Detection method')}</dt>
                          <dd>{localize(finding?.detection || 'Not checked')}</dd>
                        </div>
                      </dl>
                      {checked && !positive && (
                        <p className="helper">
                          {localize('This source reported no matching signal within its coverage.')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
function NetworkType({ label, evidence }: { label: string; evidence: PurityTypeEvidence }) {
  return (
    <div className="purity-network-type">
      <span>{localize(label)}</span>
      <strong>{localize(categories[evidence.type])}</strong>
      <small>
        {localize(
          evidence.type === 'unknown'
            ? 'No classification evidence'
            : evidence.inferred
              ? 'Inferred classification'
              : 'Provider classification',
        )}
      </small>
      <small>{localize(evidence.source || 'Source unavailable')}</small>
    </div>
  );
}
export function PurityPanel({
  data: inputData,
  ip,
  compact = false,
  loading = false,
  error,
  onRetry,
}: {
  data?: PurityResult;
  ip?: string | null;
  compact?: boolean;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}) {
  const [currentTime, setCurrentTime] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date().toISOString()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const data =
    inputData && Number.isFinite(inputData.score) && matchesIp(inputData.ip, ip) ? inputData : undefined;
  const unavailable = !data;
  const isThreatList = data?.neighborhood.activityKind === 'threat-list';
  return (
    <Card
      title="IP purity"
      subtitle="Local model · higher score means cleaner evidence"
      className={'purity-panel' + (compact ? ' compact' : '')}
      action={<ShieldCheck size={17} className="text-muted" />}
    >
      {unavailable ? (
        <div className="purity-state" role={error ? 'alert' : 'status'} aria-live="polite">
          <strong>
            {localize(
              loading
                ? 'Assessing IP purity…'
                : error || inputData
                  ? 'Purity assessment unavailable'
                  : 'A public IP is needed',
            )}
          </strong>
          <p>
            {localize(
              loading
                ? 'Checking network types, threat feeds, and neighborhood evidence.'
                : error
                  ? error.message
                  : inputData
                    ? 'The service returned an invalid assessment. Try again.'
                    : 'Look up a public IPv4 or IPv6 address to assess its purity.',
            )}
          </p>
          {!loading && onRetry && (
            <button type="button" className="button small" onClick={onRetry}>
              <RefreshCw size={13} />
              {localize('Retry assessment')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="purity-summary">
            <div
              className={
                'purity-score ' +
                (data.status === 'insufficient'
                  ? 'neutral'
                  : data.level === 'High purity'
                    ? 'clean'
                    : data.level === 'Moderate purity'
                      ? 'limited'
                      : 'risk')
              }
              style={{ '--purity': `${Math.min(100, Math.max(0, data.score))}%` } as CSSProperties}
            >
              <strong>{Math.round(data.score)}</strong>
              <span>/ 100</span>
            </div>
            <div className="purity-summary-copy">
              <Badge
                tone={
                  data.status === 'insufficient'
                    ? 'muted'
                    : data.level === 'High purity'
                      ? 'green'
                      : data.level === 'Low purity'
                        ? 'red'
                        : 'yellow'
                }
              >
                {localize(data.level)}
              </Badge>
              <p className="mono purity-address">{data.ip}</p>
              <p>{localize(confidenceLabels[data.confidence])}</p>
              <small>
                {localize('Evidence coverage')}:{' '}
                {percent((Number.isFinite(data.coverage) ? data.coverage : 0) / 100)}
              </small>
              {!compact && (
                <p className="purity-range">
                  {localize('Evidence score range')}:{' '}
                  {data.scoreRange &&
                  Number.isFinite(data.scoreRange.min) &&
                  Number.isFinite(data.scoreRange.max)
                    ? `${Math.round(data.scoreRange.min)}–${Math.round(data.scoreRange.max)} / 100`
                    : localize('Not supplied')}
                </p>
              )}
            </div>
          </div>
          {loading && (
            <p className="helper" role="status">
              {localize('Refreshing assessment…')}
            </p>
          )}
          {error && (
            <Notice error>
              {localize('Refresh failed. Showing the previous assessment.')} {localize(error.message)}
            </Notice>
          )}
          {data.status !== 'assessed' && (
            <Notice>
              {localize(
                data.status === 'insufficient'
                  ? 'Insufficient evidence. A neutral baseline is not a clean verdict.'
                  : 'Limited evidence. Missing checks retain a neutral contribution.',
              )}
            </Notice>
          )}
          {compact ? (
            <div className="purity-compact-types">
              <span>
                {localize('ASN type')}: <b>{localize(categories[data.asnType.type])}</b>
              </span>
              <span>
                {localize('Company type')}: <b>{localize(categories[data.companyType.type])}</b>
              </span>
            </div>
          ) : (
            <>
              <p className="helper">
                {localize('Confidence describes evidence coverage and quality, not a probability of safety.')}
              </p>
              {data.score <
                Math.round(
                  data.dimensions.reduce((sum, factor) => sum + (factor.score * factor.weight) / 100, 0),
                ) && (
                <Notice>
                  {localize(
                    'Specific adverse evidence applies a cap to the final score. The factor scores remain visible.',
                  )}
                </Notice>
              )}
              <div className="purity-types">
                <NetworkType label="ASN type" evidence={data.asnType} />
                <NetworkType label="Company type" evidence={data.companyType} />
              </div>
              <h3 className="purity-section-title">{localize('Scoring factors')}</h3>
              <div className="purity-factors">
                {data.dimensions.map((factor) => (
                  <div className="purity-factor" key={factor.key}>
                    <div className="purity-factor-head">
                      <strong>{localize(dimensions[factor.key])}</strong>
                      <span>
                        {localize('Factor score')}: <b>{Math.round(factor.score)} / 100</b>
                      </span>
                    </div>
                    <div className="purity-factor-meta">
                      <span>
                        {localize('Weight')}: {percent(factor.weight / 100)}
                      </span>
                      <span>
                        {localize('Evidence reliability')}:{' '}
                        {Number.isFinite(factor.reliability)
                          ? percent(factor.reliability)
                          : localize('Not supplied')}
                      </span>
                      <Badge tone={factor.observed ? 'blue' : 'muted'}>
                        {localize(
                          !factor.observed
                            ? 'Evidence unavailable'
                            : factor.inferred
                              ? 'Inferred evidence'
                              : 'Observed evidence',
                        )}
                      </Badge>
                    </div>
                    <p>{localize(factor.evidence)}</p>
                    <small>
                      {localize('Source')}: {localize(factor.sources.join(' · ') || 'Source unavailable')}
                    </small>
                  </div>
                ))}
              </div>
              <h3 className="purity-section-title">{localize('Neighbor observations')}</h3>
              <div className="purity-neighbors">
                <p>
                  <span>{localize('Neighbor sample network')}</span>
                  <strong className="mono">
                    {data.neighborhood.activityCidr ||
                      (data.neighborhood.scope === 'ipv4-/24' ? data.neighborhood.cidr : null) ||
                      localize('No network sample available')}
                  </strong>
                </p>
                <p>
                  <span>
                    {localize(isThreatList ? 'Known threat-list neighbors' : 'Recent malicious neighbors')}
                  </span>
                  <strong>
                    {data.neighborhood.activeBadNeighbors === null
                      ? localize('Count unavailable')
                      : data.neighborhood.activeBadNeighbors}
                  </strong>
                </p>
                <small>
                  {localize('Neighbor source')}:{' '}
                  {localize(
                    data.neighborhood.activitySource || data.neighborhood.source || 'Source unavailable',
                  )}
                </small>
                <p>
                  <span>{localize('Density network')}</span>
                  <strong className="mono">
                    {data.neighborhood.cidr ||
                      localize(
                        data.neighborhood.scope === 'company-network'
                          ? 'Company network'
                          : 'No network sample available',
                      )}
                  </strong>
                </p>
                <p>
                  <span>{localize('Abuse density')}</span>
                  <strong>
                    {data.neighborhood.abuseDensity === null
                      ? localize('Density unavailable')
                      : percent(data.neighborhood.abuseDensity)}
                  </strong>
                </p>
                <small>
                  {localize('Density source')}: {localize(data.neighborhood.source || 'Source unavailable')}
                </small>
              </div>
              <p className="helper">
                {localize(
                  isThreatList
                    ? 'CINS neighbors appear in its current published threat list. Individual event times are not supplied. This does not measure general traffic or online activity and does not prove this IP is malicious.'
                    : 'Neighbors are recent malicious addresses reported by the listed source. This is not a measurement of general network activity or proof this IP is malicious.',
                )}
              </p>
              <h3 className="purity-section-title">{localize('Evidence sources')}</h3>
              {data.feeds.length ? (
                <div className="purity-feeds">
                  {data.feeds.map((feed, index) => (
                    <div
                      key={`${feed.source}:${index}`}
                      className="purity-feed"
                      data-feed-status={feed.status || (feed.checked ? 'available' : 'unavailable')}
                    >
                      <div>
                        <a href={feed.url} target="_blank" rel="noreferrer">
                          {localize(feed.source)}
                        </a>
                        <Badge tone={feed.checked ? 'blue' : 'muted'}>
                          {localize(
                            feed.status === 'stale'
                              ? 'Feed stale'
                              : feed.status === 'unsupported'
                                ? 'IP family unsupported'
                                : feed.checked
                                  ? 'Checked'
                                  : 'Feed unavailable',
                          )}
                        </Badge>
                      </div>
                      <small>
                        {localize('Feed published at')}: {timestamp(feed.updatedAt)}
                      </small>
                      <small>
                        {localize('Feed fetched at')}: {timestamp(feed.fetchedAt)}
                      </small>
                      <small>
                        {localize('Feed expires at')}: {timestamp(feed.expiresAt)}
                      </small>
                      <small>
                        {localize('Data origin')}:{' '}
                        {localize(
                          feed.origin === 'snapshot'
                            ? 'Bundled offline snapshot'
                            : feed.origin === 'live'
                              ? 'Live download'
                              : 'Origin not supplied',
                        )}
                      </small>
                      {feed.copyright &&
                        (feed.copyright.length > 240 ? (
                          <details className="purity-license">
                            <summary>{localize('Source license and attribution')}</summary>
                            <pre>{feed.copyright}</pre>
                          </details>
                        ) : (
                          <small>{feed.copyright}</small>
                        ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="helper">
                  {localize('No public threat feed was available for this assessment.')}
                </p>
              )}
              <p className="helper">
                {localize(
                  'Public feeds cover selected threats and current observations. No match does not prove an IP has no abuse history.',
                )}
              </p>
              {data.conflicts.length > 0 && (
                <Notice>
                  {localize(
                    'Conflicting source findings were retained; inspect the evidence before relying on the score.',
                  )}{' '}
                  {data.conflicts.map((key) => localize(key)).join(', ')}
                </Notice>
              )}
              {data.warnings.map((warning) => (
                <p className="helper" key={warning}>
                  {localize(warning)}
                </p>
              ))}
            </>
          )}
        </>
      )}
      {!compact && (
        <>
          <SignalEvidence data={data} />
          <h3 className="purity-section-title">{localize('Recommended next steps')}</h3>
          <ul className="purity-recommendations">
            {(data?.recommendations?.length
              ? data.recommendations
              : [
                  data
                    ? 'Review source coverage and freshness before relying on this assessment.'
                    : 'Query a public IP or retry the assessment to obtain evidence.',
                ]
            ).map((recommendation, index) => (
              <li key={index}>{localize(recommendation)}</li>
            ))}
          </ul>
        </>
      )}
      <dl className="purity-assessment-meta">
        <div>
          <dt>{localize('Assessment model')}</dt>
          <dd>{data?.model || localize('Not assessed')}</dd>
        </div>
        <div>
          <dt>{localize('Assessed at')}</dt>
          <dd>{timestamp(data?.assessedAt)}</dd>
        </div>
        <div>
          <dt>{localize('Current time')}</dt>
          <dd>
            <time dateTime={currentTime}>{timestamp(currentTime)}</time>
          </dd>
        </div>
      </dl>
      {compact && (
        <Link className="card-link" to={ip ? `/risk?ip=${encodeURIComponent(ip)}` : '/risk'}>
          {localize('Inspect purity evidence')}
          <ArrowRight size={14} />
        </Link>
      )}
    </Card>
  );
}

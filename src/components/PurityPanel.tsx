import type { CSSProperties } from 'react';
import { ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { locale, localize } from '../config/i18n';
import type { NetworkCategory, PurityDimensionKey, PurityResult, PurityTypeEvidence } from '../types';
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
function timestamp(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return localize('Timestamp not supplied');
  return new Date(value).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
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
  data,
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
  const valid = data && Number.isFinite(data.score);
  const unavailable = !valid;
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
                : error || data
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
                  : data
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
                  {data.feeds.map((feed) => (
                    <div key={feed.source} className="purity-feed">
                      <div>
                        <a href={feed.url} target="_blank" rel="noreferrer">
                          {localize(feed.source)}
                        </a>
                        <Badge tone={feed.checked ? 'blue' : 'muted'}>
                          {localize(feed.checked ? 'Checked' : 'Feed unavailable')}
                        </Badge>
                      </div>
                      <small>
                        {localize('Feed timestamp')}: {timestamp(feed.updatedAt)}
                      </small>
                      {feed.copyright && <small>{feed.copyright}</small>}
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
              <p className="helper">
                {localize('Assessment model')}: {data.model} · {localize('Assessed at')}:{' '}
                {timestamp(data.assessedAt)}
              </p>
            </>
          )}
        </>
      )}
      {compact && (
        <Link className="card-link" to={ip ? `/risk?ip=${encodeURIComponent(ip)}` : '/risk'}>
          {localize('Inspect purity evidence')}
          <ArrowRight size={14} />
        </Link>
      )}
    </Card>
  );
}

import { purityModel, purityWeights } from '../config/purity.config';
import type {
  NetworkCategory,
  PurityDimension,
  PurityInput,
  PurityResult,
  PurityTypeEvidence,
  RiskKey,
  RiskSignal,
} from '../types';

const clamp = (n: number) => Math.min(100, Math.max(0, n));
const typeQuality: Record<NetworkCategory, number> = {
  isp: 90,
  hosting: 25,
  business: 70,
  education: 75,
  government: 75,
  unknown: 50,
};
const anonymityPenalties = { tor: 90, proxy: 75, vpn: 55, anonymous: 70 } as const;
const abuseKeys: RiskKey[] = ['abuse', 'bot', 'spam', 'blacklist'];
const unknownType: PurityTypeEvidence = { type: 'unknown', inferred: false, source: 'Local model' };

/** Deterministic heuristic: unknown factors retain a neutral prior, never a clean finding. */
export function calculatePurity(ip: string, input: PurityInput, now = new Date()): PurityResult {
  const signals: RiskSignal[] = input.signals.map((signal) => ({
    ...signal,
    value:
      typeof signal.value === 'number'
        ? Number.isFinite(signal.value)
          ? Math.min(1, Math.max(0, signal.value))
          : null
        : signal.value,
  }));
  const evidence = (keys: readonly string[]) =>
    signals.filter((s) => keys.includes(s.key) && s.value !== null);
  const conflicts = [...new Set(signals.map((s) => s.key))].filter(
    (key) => new Set(evidence([key]).map((s) => Number(s.value))).size > 1,
  );
  const dimensions: PurityDimension[] = [];
  let coverage = 0;
  const add = (
    key: PurityDimension['key'],
    score: number,
    reliability: number,
    message: string,
    sources: string[],
    inferred = false,
  ) => {
    coverage += purityWeights[key] * reliability;
    dimensions.push({
      key,
      score: Math.round(clamp(score)),
      weight: purityWeights[key],
      observed: reliability > 0,
      inferred,
      evidence: message,
      sources: [...new Set(sources)],
    });
  };
  for (const [key, finding] of [
    ['asn', input.asnType],
    ['company', input.companyType],
  ] as const) {
    const known = finding && finding.type !== 'unknown';
    const reliability = known ? (finding.inferred ? 0.5 : 1) : 0;
    add(
      key,
      known ? 50 + (typeQuality[finding.type] - 50) * reliability : 50,
      reliability,
      known
        ? finding.inferred
          ? 'Estimated from organization name'
          : 'Provider network classification'
        : 'Network classification unavailable',
      finding ? [finding.source] : [],
      known && finding.inferred,
    );
  }

  // Related VPN/proxy/Tor findings share a single dimension and never accumulate.
  const anonymity = evidence(Object.keys(anonymityPenalties));
  const anonymitySeverity = Math.max(
    0,
    ...anonymity.map((s) => Number(s.value) * anonymityPenalties[s.key as keyof typeof anonymityPenalties]),
  );
  const anonymityCoverage =
    new Set(anonymity.filter((s) => s.key !== 'anonymous').map((s) => s.key)).size / 3;
  const anonymityQuality = 50 + 45 * anonymityCoverage;
  add(
    'anonymity',
    anonymityQuality - anonymitySeverity,
    Math.max(anonymityCoverage, anonymitySeverity / 100),
    anonymitySeverity > 0
      ? 'Anonymity detected'
      : anonymityCoverage === 1
        ? 'No anonymity flags in checked sources'
        : 'Anonymity checks incomplete',
    anonymity.map((s) => s.source),
  );

  const abuse = evidence(abuseKeys);
  const severity = Math.max(0, ...abuse.map((s) => Number(s.value)));
  // A feed miss is a limited negative: these feeds do not cover every abuse category.
  const threatFeeds = input.feeds.filter((feed) => feed.checked && /Spamhaus|Feodo/i.test(feed.source));
  const abuseCoverage = Math.max(
    new Set(abuse.map((s) => s.key)).size / 4,
    Math.min(0.35, threatFeeds.length * 0.175),
  );
  add(
    'abuse',
    (50 + 45 * abuseCoverage) * (1 - severity),
    Math.max(abuseCoverage, severity),
    severity > 0
      ? 'Recent abuse or threat detected'
      : threatFeeds.length
        ? 'No match in limited public threat feeds'
        : 'Abuse checks incomplete',
    [...abuse.map((s) => s.source), ...threatFeeds.map((f) => f.source)],
  );

  const neighborhood = input.neighborhood ?? {
    cidr: null,
    activeBadNeighbors: null,
    abuseDensity: null,
    scope: 'none' as const,
    source: 'Local model',
  };
  const count = neighborhood.activeBadNeighbors;
  const density = neighborhood.abuseDensity;
  const hasCount = count !== null && Number.isFinite(count) && count >= 0;
  const hasDensity = density !== null && Number.isFinite(density) && density >= 0 && density <= 1;
  // This is malicious activity in an intelligence feed, not generic traffic or liveness.
  // No /64 enumeration or bogus IPv6 activity percentages are used.
  const neighborQuality = hasCount ? Math.max(15, 80 - count * 15) : 100;
  const densityQuality = hasDensity ? Math.max(0, 90 - 90 * Math.sqrt(density)) : 100;
  add(
    'neighborhood',
    hasCount || hasDensity ? Math.min(neighborQuality, densityQuality) : 50,
    hasDensity ? 0.8 : hasCount ? 0.35 : 0,
    hasDensity
      ? 'Company network abuse density'
      : hasCount
        ? count > 0
          ? neighborhood.activityKind === 'threat-list'
            ? 'Known threat-list neighbors observed'
            : 'Recent malicious neighbors observed'
          : neighborhood.activityKind === 'threat-list'
            ? 'No neighbors in this limited threat list'
            : 'No recent malicious neighbors in this feed'
        : 'Neighborhood data unavailable',
    hasCount || hasDensity ? [neighborhood.source] : [],
  );

  let score = Math.round(dimensions.reduce((sum, d) => sum + (d.score * d.weight) / 100, 0));
  const directThreat = abuse.some((s) => Number(s.value) > 0 && /Spamhaus|Feodo/i.test(s.source));
  // Specific adverse evidence overrides favorable network ownership and missing checks.
  if (directThreat) score = Math.min(score, 10);
  else if (severity >= 0.75) score = Math.min(score, 25);
  else if (severity >= 0.4) score = Math.min(score, 50);
  if (anonymitySeverity >= 75) score = Math.min(score, 30);
  else if (anonymitySeverity >= 55) score = Math.min(score, 55);
  const hosting = evidence(['hosting', 'datacenter']).some((s) => Number(s.value) > 0);
  // Explicit hosting prevents an inferred ISP classification from earning a pristine verdict.
  if (hosting) score = Math.min(score, 65);
  coverage = Math.round(coverage);
  const adverse = directThreat || severity > 0 || anonymitySeverity > 0;
  const status = coverage >= 75 ? 'assessed' : coverage >= 25 || adverse ? 'limited' : 'insufficient';
  const warnings = [...input.warnings];
  if (status !== 'assessed')
    warnings.push('Incomplete evidence; the score is a conservative local estimate.');
  if (conflicts.length) warnings.push('Conflicting sources; adverse evidence takes precedence.');
  return {
    ip,
    score: clamp(score),
    level:
      status === 'insufficient'
        ? 'Insufficient evidence'
        : score < 60
          ? 'Low purity'
          : score >= 85 && coverage >= 75 && !hosting && !adverse
            ? 'High purity'
            : 'Moderate purity',
    confidence: directThreat || coverage >= 75 ? 'High' : coverage >= 40 ? 'Medium' : 'Low',
    coverage,
    status,
    model: purityModel,
    assessedAt: now.toISOString(),
    dimensions,
    asnType: input.asnType ?? { ...unknownType },
    companyType: input.companyType ?? { ...unknownType },
    neighborhood,
    feeds: input.feeds,
    signals,
    conflicts,
    sources: [...new Set(['Local model', ...dimensions.flatMap((d) => d.sources)])],
    warnings: [...new Set(warnings)],
  };
}

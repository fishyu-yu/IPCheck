import { describe, expect, it } from 'vitest';
import { calculatePurity } from '../src/lib/purity';
import type { PurityInput, RiskKey, RiskSignal } from '../src/types';

const signal = (key: RiskKey, value: boolean | number | null, source = 'Provider'): RiskSignal => ({
  key,
  value,
  source,
  confidence: null,
  detection: 'Provider Detection',
});
const empty: PurityInput = { signals: [], feeds: [], warnings: [] };
const comprehensive: PurityInput = {
  asnType: { type: 'isp', source: 'Provider', inferred: false },
  companyType: { type: 'isp', source: 'Provider', inferred: false },
  signals: [
    signal('vpn', false),
    signal('proxy', false),
    signal('tor', false),
    signal('abuse', false),
    signal('bot', false),
    signal('spam', false),
    signal('blacklist', false),
  ],
  neighborhood: {
    cidr: '8.8.8.0/24',
    abuseDensity: 0,
    activeBadNeighbors: null,
    scope: 'company-network',
    source: 'Provider',
  },
  feeds: [],
  warnings: [],
};

describe('local purity model', () => {
  it('always returns five populated neutral dimensions and never calls no data clean', () => {
    const result = calculatePurity('8.8.8.8', empty);
    expect(result.score).toBe(50);
    expect(result.level).toBe('Insufficient evidence');
    expect(result.status).toBe('insufficient');
    expect(result.confidence).toBe('Low');
    expect(result.coverage).toBe(0);
    expect(result.dimensions).toHaveLength(5);
    expect(result.dimensions.every((d) => d.score === 50 && d.evidence.length > 0)).toBe(true);
    expect(result.asnType.type).toBe('unknown');
    expect(result.neighborhood.activeBadNeighbors).toBeNull();
  });
  it('requires substantial evidence before a high-purity verdict', () => {
    const result = calculatePurity('8.8.8.8', comprehensive);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.level).toBe('High purity');
    expect(result.coverage).toBeGreaterThanOrEqual(75);
    expect(result.status).toBe('assessed');
    const typesOnly = calculatePurity('8.8.8.8', { ...comprehensive, signals: [], neighborhood: undefined });
    expect(typesOnly.level).not.toBe('High purity');
  });
  it('keeps ASN ISP and company hosting independent', () => {
    const result = calculatePurity('8.8.8.8', {
      ...comprehensive,
      companyType: { type: 'hosting', source: 'Provider', inferred: false },
    });
    expect(result.dimensions.find((d) => d.key === 'asn')?.score).toBe(90);
    expect(result.dimensions.find((d) => d.key === 'company')?.score).toBe(25);
    expect(result.level).not.toBe('High purity');
  });
  it('discounts name inference and does not advertise it as provider classification', () => {
    const result = calculatePurity('8.8.8.8', {
      ...empty,
      asnType: { type: 'isp', source: 'Local name inference', inferred: true },
    });
    expect(result.coverage).toBe(8);
    expect(result.dimensions[0]).toMatchObject({
      score: 70,
      inferred: true,
      evidence: 'Estimated from organization name',
    });
  });
  it.each(['Tor Project', 'Other provider'])(
    'specific Tor evidence defeats ISP positives from %s',
    (source) => {
      const result = calculatePurity('8.8.8.8', {
        ...comprehensive,
        signals: [...comprehensive.signals, signal('tor', true, source)],
      });
      expect(result.score).toBeLessThanOrEqual(30);
      expect(result.level).toBe('Low purity');
      expect(result.conflicts).toContain('tor');
    },
  );
  it('does not triple-count correlated anonymity detections', () => {
    const torOnly = calculatePurity('8.8.8.8', { ...empty, signals: [signal('tor', true)] });
    const all = calculatePurity('8.8.8.8', {
      ...empty,
      signals: [signal('tor', true), signal('proxy', true), signal('vpn', true)],
    });
    expect(all.score).toBe(torOnly.score);
    expect(all.dimensions[2].score).toBeLessThanOrEqual(10);
  });
  it.each(['Spamhaus Project DROP', 'Feodo Tracker'])('caps confirmed direct threat %s at ten', (source) => {
    const result = calculatePurity('8.8.8.8', {
      ...comprehensive,
      signals: [...comprehensive.signals, signal('blacklist', true, source)],
    });
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.confidence).toBe('High');
  });
  it('uses strongest numeric abuse and tolerates invalid evidence', () => {
    const result = calculatePurity('8.8.8.8', {
      ...comprehensive,
      signals: [...comprehensive.signals, signal('abuse', 0.8), signal('spam', NaN), signal('bot', Infinity)],
    });
    expect(result.score).toBeLessThanOrEqual(25);
    expect(result.signals.slice(-2).every((s) => s.value === null)).toBe(true);
    expect(Number.isFinite(result.score)).toBe(true);
  });
  it('explicit hosting overrides favorable ISP metadata without stacked hosting penalties', () => {
    const single = calculatePurity('8.8.8.8', {
      ...comprehensive,
      signals: [...comprehensive.signals, signal('datacenter', true)],
    });
    const doubled = calculatePurity('8.8.8.8', {
      ...comprehensive,
      signals: [...comprehensive.signals, signal('datacenter', true), signal('hosting', true)],
    });
    expect(single.score).toBeLessThanOrEqual(65);
    expect(single.score).toBe(doubled.score);
    expect(single.level).not.toBe('High purity');
  });
  it('keeps misses in narrow feeds limited, even with guessed ISP types', () => {
    const result = calculatePurity('8.8.8.8', {
      ...empty,
      asnType: { type: 'isp', source: 'Local name inference', inferred: true },
      companyType: { type: 'isp', source: 'Local name inference', inferred: true },
      signals: [signal('tor', false, 'Tor Project')],
      feeds: ['Spamhaus Project', 'Feodo Tracker'].map((source) => ({
        source,
        checked: true,
        updatedAt: '2026-10-04T00:00:00Z',
        url: 'https://example.com/feed',
      })),
      neighborhood: {
        cidr: '8.8.8.0/24',
        activeBadNeighbors: 0,
        abuseDensity: null,
        scope: 'ipv4-/24',
        source: 'Feodo Tracker',
      },
    });
    expect(result.level).not.toBe('High purity');
    expect(result.confidence).not.toBe('High');
    expect(result.dimensions[3].evidence).toBe('No match in limited public threat feeds');
  });
  it('isolates malicious neighbors from direct guilt and reduces quality monotonically', () => {
    const neighborInput = (count: number): PurityInput => ({
      ...comprehensive,
      neighborhood: {
        cidr: '8.8.8.0/24',
        activeBadNeighbors: count,
        abuseDensity: null,
        scope: 'ipv4-/24',
        source: 'Feodo Tracker',
      },
    });
    const none = calculatePurity('8.8.8.8', neighborInput(0));
    const one = calculatePurity('8.8.8.8', neighborInput(1));
    const many = calculatePurity('8.8.8.8', neighborInput(10));
    expect(one.score).toBeLessThan(none.score);
    expect(many.score).toBeLessThan(one.score);
    expect(many.score).toBeGreaterThan(30);
    expect(many.signals.some((s) => Boolean(s.value))).toBe(false);
  });
  it('exposes deterministic model and assessment time for auditing', () => {
    const result = calculatePurity('2606:4700::1111', empty, new Date('2026-10-04T00:00:00Z'));
    expect(result.assessedAt).toBe('2026-10-04T00:00:00.000Z');
    expect(result.model).toBe('local-purity-v1');
    expect(result.neighborhood.scope).toBe('none');
  });
  it.each(['vpn', 'abuse'] as const)(
    'small positive %s evidence never improves purity or coverage',
    (key) => {
      const clean = calculatePurity('8.8.8.8', { ...empty, signals: [signal(key, false)] });
      const suspect = calculatePurity('8.8.8.8', { ...empty, signals: [signal(key, 0.01)] });
      expect(suspect.score).toBeLessThanOrEqual(clean.score);
      expect(suspect.coverage).toBe(clean.coverage);
      const full = calculatePurity('8.8.8.8', {
        ...comprehensive,
        signals: [...comprehensive.signals, signal(key, 0.01)],
      });
      expect(full.score).toBeLessThanOrEqual(calculatePurity('8.8.8.8', comprehensive).score);
      expect(full.level).not.toBe('High purity');
    },
  );
  it('does not use a generic anonymous alias to fill a missing proxy check', () => {
    const result = calculatePurity('8.8.8.8', {
      ...empty,
      signals: [signal('vpn', false), signal('tor', false), signal('anonymous', false)],
    });
    expect(result.dimensions[2].evidence).toBe('Anonymity checks incomplete');
    expect(result.coverage).toBe(20);
  });
});

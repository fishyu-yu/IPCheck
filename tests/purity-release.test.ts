import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculatePurity } from '../src/lib/purity';
import { purityRefreshInterval } from '../src/lib/purity-freshness';
import { parseIpquery } from '../api/purity/ipquery';
import { parseProxycheck } from '../api/purity/proxycheck';
import { createApp } from '../api/app';
import { localAdapter } from '../edge/local/adapter';
import type { PurityFeedEvidence, PurityInput, RiskKey, RiskSignal } from '../src/types';

const collector = vi.hoisted(() => vi.fn());
vi.mock('../api/purity/providers', () => ({ collectPurity: collector }));

const target = '8.8.8.42';
const now = Date.parse('2026-10-05T00:00:00Z');
const empty: PurityInput = { signals: [], feeds: [], warnings: [] };
const signal = (
  key: RiskKey,
  value: boolean | number | null,
  confidence: number | null = null,
  source = 'Provider',
): RiskSignal => ({ key, value, confidence, source, detection: 'Provider Detection' });
const feed = (source: string, expiresAt?: string): PurityFeedEvidence => ({
  source,
  url: 'https://example.com/feed',
  checked: true,
  updatedAt: null,
  status: 'available',
  ...(expiresAt === undefined ? {} : { expiresAt }),
});
const comprehensive = (expiresAt?: string): PurityInput => ({
  asnType: { type: 'isp', source: 'Provider', inferred: false },
  companyType: { type: 'isp', source: 'Provider', inferred: false },
  signals: ['vpn', 'proxy', 'tor', 'abuse', 'bot', 'spam', 'blacklist'].map((key) =>
    signal(key as RiskKey, false),
  ),
  neighborhood: {
    cidr: '8.8.8.0/24',
    activeBadNeighbors: null,
    abuseDensity: 0,
    scope: 'company-network',
    source: 'Provider',
  },
  feeds: [feed('Provider', expiresAt)],
  warnings: [],
});
const assess = (input: PurityInput, at = now) => calculatePurity(target, input, new Date(at));

describe('purity release invariants', () => {
  beforeEach(() => {
    collector.mockReset().mockResolvedValue(empty);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not reward a real partial Proxycheck proxy detection added to an IPQuery VPN detection', () => {
    const query = parseIpquery(target, { ip: target, risk: { is_vpn: true } });
    const proxy = parseProxycheck(target, {
      status: 'ok',
      [target]: { detections: { proxy: true, confidence: 50 } },
    });
    const baseline = assess({ ...empty, signals: query.signals! });
    const combined = assess({ ...empty, signals: [...query.signals!, ...proxy.signals!] });
    expect(combined.score).toBeLessThanOrEqual(baseline.score);
    expect(combined.dimensions[2].score).toBeLessThanOrEqual(baseline.dimensions[2].score);
    expect(combined.coverage).toBeGreaterThanOrEqual(baseline.coverage);
    expect(combined.level).not.toBe('High purity');
  });

  it('never increases purity when adding a correlated positive boolean at the supported confidence boundaries', () => {
    const keys: RiskKey[] = ['vpn', 'proxy', 'tor', 'anonymous'];
    const strengths = [0, 0.01, 0.1, 0.5, 0.6, 0.75, 0.85, 1, null];
    for (const first of keys)
      for (const second of keys) {
        if (first === second) continue;
        for (const firstStrength of strengths)
          for (const secondStrength of strengths) {
            const before = assess({ ...empty, signals: [signal(first, true, firstStrength)] });
            const after = assess({
              ...empty,
              signals: [signal(first, true, firstStrength), signal(second, true, secondStrength)],
            });
            expect(
              after.score,
              JSON.stringify({ first, second, firstStrength, secondStrength }),
            ).toBeLessThanOrEqual(before.score);
          }
      }
  });

  it('does not grant a clean bonus to a false observation contradicted by a positive finding on the same key', () => {
    const adverse = signal('vpn', true, 0.6, 'Prefix evidence');
    const before = assess({ ...empty, signals: [adverse] });
    const after = assess({
      ...empty,
      signals: [adverse, signal('vpn', false, null, 'Another provider'), signal('anonymous', false)],
    });
    expect(after.dimensions[2].score).toBe(before.dimensions[2].score);
    expect(after.conflicts).toContain('vpn');
    expect(after.dimensions[2].evidence).toBe('Anonymity detected');
    expect(after.coverage).toBeGreaterThanOrEqual(before.coverage);
  });

  it('does not reward additional positive boolean abuse categories at lower or equal confidence', () => {
    const keys: RiskKey[] = ['abuse', 'bot', 'spam', 'blacklist'];
    const strengths = [0, 0.01, 0.1, 0.5, 0.6, 0.75, 0.85, 1, null];
    for (const first of keys)
      for (const second of keys) {
        if (first === second) continue;
        for (const firstStrength of strengths)
          for (const secondStrength of strengths) {
            const before = assess({ ...empty, signals: [signal(first, true, firstStrength)] });
            const after = assess({
              ...empty,
              signals: [signal(first, true, firstStrength), signal(second, true, secondStrength)],
            });
            expect(
              after.score,
              JSON.stringify({ first, second, firstStrength, secondStrength }),
            ).toBeLessThanOrEqual(before.score);
          }
      }
  });

  it('does not turn an observed threat-feed match or contradictory abuse negative into a clean-feed bonus', () => {
    const positive = signal('blacklist', true, 0.3, 'Spamhaus Project DROP');
    const before = assess({ ...empty, signals: [positive] });
    const withFeed = assess({ ...empty, signals: [positive], feeds: [feed('Spamhaus Project DROP')] });
    const withConflict = assess({
      ...empty,
      signals: [positive, signal('blacklist', false)],
      feeds: [feed('Spamhaus Project DROP')],
    });
    expect(withFeed.score).toBeLessThanOrEqual(before.score);
    expect(withConflict.score).toBeLessThanOrEqual(before.score);
    expect(withConflict.conflicts).toContain('blacklist');
    expect(withConflict.dimensions[3].evidence).toBe('Recent abuse or threat detected');
  });

  it('preserves scalar risk monotonicity, source order and finite bounds across reproducible mixed inputs', () => {
    let seed = 0x451abcde;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const keys: RiskKey[] = [
      'vpn',
      'proxy',
      'tor',
      'anonymous',
      'abuse',
      'bot',
      'spam',
      'blacklist',
      'hosting',
    ];
    for (let trial = 0; trial < 500; trial++) {
      const signals = keys.filter(() => random() < 0.6).map((key) => signal(key, random(), random()));
      if (!signals.length) signals.push(signal('abuse', 0.1, 0.5));
      const input: PurityInput = {
        ...comprehensive(),
        signals,
        neighborhood: {
          ...comprehensive().neighborhood!,
          activeBadNeighbors: Math.floor(random() * 255),
          abuseDensity: random(),
        },
      };
      const baseline = assess(input);
      const chosen = Math.floor(random() * signals.length);
      const stronger = signals.map((entry, index) =>
        index === chosen
          ? { ...entry, value: Number(entry.value) + (1 - Number(entry.value)) * random() }
          : entry,
      );
      const raised = assess({ ...input, signals: stronger });
      const reordered = assess({ ...input, signals: [...signals].reverse() });
      expect(raised.score).toBeLessThanOrEqual(baseline.score);
      expect(reordered.score).toBe(baseline.score);
      expect(reordered.coverage).toBe(baseline.coverage);
      expect(baseline.coverage).toBeGreaterThanOrEqual(0);
      expect(baseline.coverage).toBeLessThanOrEqual(100);
      expect(baseline.scoreRange.min).toBeLessThanOrEqual(baseline.score);
      expect(baseline.scoreRange.max).toBeGreaterThanOrEqual(baseline.score);
      expect(Number.isFinite(baseline.score)).toBe(true);
    }
  });

  it.each([now - 1, now, now + 1])(
    'applies the exact source deadline boundary %s without mutating input',
    (deadline) => {
      const input: PurityInput = {
        ...empty,
        signals: [signal('blacklist', true, null, 'Spamhaus Project DROP')],
        feeds: [feed('Spamhaus Project DROP', new Date(deadline).toISOString())],
      };
      const original = structuredClone(input);
      const result = assess(input);
      if (deadline <= now) {
        expect(result.score).toBe(50);
        expect(result.coverage).toBe(0);
        expect(result.feeds[0]).toMatchObject({ checked: false, status: 'stale' });
        expect(result.signals[0].value).toBeNull();
      } else {
        expect(result.score).toBeLessThanOrEqual(10);
        expect(result.feeds[0].checked).toBe(true);
      }
      expect(input).toEqual(original);
    },
  );

  it('does not use an invalid declared source deadline as perpetual clean evidence', () => {
    const result = assess(comprehensive('not-a-timestamp'));
    expect(result.score).toBe(50);
    expect(result.coverage).toBe(0);
    expect(result.asnType.type).toBe('unknown');
    expect(result.companyType.type).toBe('unknown');
    expect(result.signals.every((entry) => entry.value === null)).toBe(true);
    expect(result.neighborhood.abuseDensity).toBeNull();
  });

  it.each(['count', 'density'] as const)(
    'expires mixed neighbor %s independently from the other source',
    (expired) => {
      const input: PurityInput = {
        ...empty,
        feeds: [feed(expired === 'count' ? 'CINS Army' : 'Company density', new Date(now).toISOString())],
        neighborhood: {
          cidr: '8.8.0.0/16',
          activityCidr: '8.8.8.0/24',
          activeBadNeighbors: 10,
          abuseDensity: 0.1,
          scope: 'company-network',
          source: 'Company density',
          activitySource: 'CINS Army',
        },
      };
      const result = assess(input);
      expect(result.neighborhood.activeBadNeighbors).toBe(expired === 'count' ? null : 10);
      expect(result.neighborhood.abuseDensity).toBe(expired === 'density' ? null : 0.1);
      expect(result.dimensions[4].sources).toEqual([expired === 'count' ? 'Company density' : 'CINS Army']);
    },
  );

  it('caps both assessed and limited refresh intervals at the earliest checked source deadline', () => {
    const assessed = assess(comprehensive());
    expect(assessed.status).toBe('assessed');
    expect(purityRefreshInterval(assessed, now)).toBe(900_000);
    expect(purityRefreshInterval(undefined, now)).toBe(60_000);
    for (const status of ['assessed', 'limited', 'insufficient'] as const) {
      const data = {
        ...assessed,
        status,
        feeds: [feed('A', new Date(now + 7000).toISOString()), feed('B', new Date(now + 2000).toISOString())],
      };
      expect(purityRefreshInterval(data, now)).toBe(2000);
      expect(purityRefreshInterval(data, now + 1500)).toBe(1000);
      expect(purityRefreshInterval(data, now + 5000)).toBe(1000);
    }
    expect(purityRefreshInterval({ ...assessed, feeds: [feed('A', 'invalid')] }, now)).toBe(1000);
    expect(purityRefreshInterval({ ...assessed, warnings: ['Provider unavailable'] }, now)).toBe(60_000);
    expect(purityRefreshInterval({ ...assessed, feeds: [{ ...feed('A'), checked: false }] }, now)).toBe(
      60_000,
    );
  });

  it('recomputes an API assessment once the source deadline expires instead of keeping its 15-minute result', async () => {
    collector.mockResolvedValue(comprehensive(new Date(now + 1000).toISOString()));
    const app = createApp(localAdapter());
    const env = { GEO_FREE_PROVIDER: 'off', PURITY_PUBLIC_FEEDS: 'off', PURITY_IPQUERY: 'off' };
    const first = await app.request('/api/purity/8.8.8.42', {}, env);
    expect((await first.json()).data.status).toBe('assessed');
    vi.setSystemTime(now + 2000);
    const second = await app.request('/api/purity/8.8.8.42', {}, env);
    const result = (await second.json()).data;
    expect(collector).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('insufficient');
    expect(result.feeds[0]).toMatchObject({ checked: false, status: 'stale' });
    expect(result.score).toBe(50);
  });

  it('discards source findings that expire while slower evidence collection is still pending', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const input = comprehensive(new Date(now + 1000).toISOString());
    collector.mockImplementation(async () => {
      await gate;
      return input;
    });
    const app = createApp(localAdapter());
    const request = app.request(
      '/api/purity/8.8.8.43',
      {},
      {
        GEO_FREE_PROVIDER: 'off',
        PURITY_PUBLIC_FEEDS: 'off',
        PURITY_IPQUERY: 'off',
      },
    );
    await vi.waitFor(() => expect(collector).toHaveBeenCalledTimes(1));
    vi.setSystemTime(now + 2000);
    release();
    const result = (await (await request).json()).data;
    expect(result.score).toBe(50);
    expect(result.signals.every((entry: RiskSignal) => entry.value === null)).toBe(true);
    expect(result.feeds[0].status).toBe('stale');
  });
});

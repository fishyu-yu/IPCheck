import { riskModel, riskWeights } from '../config/risk.config';
import type { RiskKey, RiskResult, RiskSignal } from '../types';
export function calculateRisk(ip: string, signals: RiskSignal[], warnings: string[] = []): RiskResult {
  const keys = Object.keys(riskWeights) as RiskKey[];
  let score = 0,
    checked = 0;
  const conflicts: RiskKey[] = [];
  const normalized = signals.map((s) => ({
    ...s,
    value:
      typeof s.value === 'number'
        ? Number.isFinite(s.value)
          ? Math.min(1, Math.max(0, s.value))
          : null
        : s.value,
  }));
  for (const key of keys) {
    const evidence = normalized.filter((s) => s.key === key && s.value !== null);
    if (!evidence.length) continue;
    checked++;
    const severity = evidence.map((s) => Number(s.value));
    if (new Set(severity).size > 1) conflicts.push(key);
    score += Math.max(...severity) * riskWeights[key];
  }
  const result = checked ? Math.min(100, Math.round(score)) : null;
  return {
    ip,
    score: result,
    level:
      result === null
        ? 'Not checked'
        : result < 25
          ? 'Low Risk'
          : result < 60
            ? 'Moderate Risk'
            : 'High Risk',
    signals: normalized,
    checked,
    total: keys.length,
    conflicts,
    partial: checked < keys.length,
    model: riskModel,
    sources: [...new Set(signals.map((s) => s.source))],
    warnings,
  };
}

export function statistics(values: number[]) {
  const v = values.filter((n) => Number.isFinite(n) && n >= 0);
  if (!v.length) return null;
  const sorted = [...v].sort((a, b) => a - b),
    n = v.length;
  return {
    min: sorted[0],
    average: v.reduce((a, b) => a + b, 0) / n,
    median: n % 2 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    p95: sorted[Math.ceil(n * 0.95) - 1],
    max: sorted[n - 1],
    jitter: n > 1 ? v.slice(1).reduce((sum, x, i) => sum + Math.abs(x - v[i]), 0) / (n - 1) : 0,
  };
}

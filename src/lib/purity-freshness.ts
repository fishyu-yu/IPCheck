import type { PurityResult } from '../types';

/** Never retain an assessment beyond the lifetime of its checked sources. */
export function purityRefreshInterval(data?: PurityResult, now = Date.now()): number {
  let interval =
    !data ||
    data.status !== 'assessed' ||
    data.feeds.some((feed) => !feed.checked) ||
    data.warnings.some((warning) => /unavailable|invalid|no valid|no .*returned/i.test(warning))
      ? 60_000
      : 900_000;
  for (const feed of data?.feeds ?? []) {
    if (!feed.checked || !feed.expiresAt) continue;
    const deadline = Date.parse(feed.expiresAt);
    interval = Math.min(interval, Number.isFinite(deadline) ? deadline - now : 0);
  }
  return Math.max(1000, interval);
}

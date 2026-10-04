const flights = new Map<string, Promise<unknown>>();
const providerStates = new Map<string, { until: number; active: number }>();

/** Merge identical work; callers provide a credential-isolated cache key. */
export async function coalesced<T>(key: string, load: () => Promise<T>): Promise<T> {
  const pending = flights.get(key);
  if (pending) return pending as Promise<T>;
  // Bound merge bookkeeping. Upstream concurrency remains protected separately.
  if (flights.size >= 512) return load();
  const promise = load();
  flights.set(key, promise);
  try {
    return await promise;
  } finally {
    if (flights.get(key) === promise) flights.delete(key);
  }
}

/** Only uncached upstream calls enter a provider/credential-specific circuit. */
export async function protectedLookup<T>(
  key: string,
  load: () => Promise<T>,
  options: { cooldownMs?: number; maxConcurrent?: number } = {},
): Promise<T> {
  let state = providerStates.get(key);
  if (!state) {
    if (providerStates.size >= 32) {
      const removable = [...providerStates].find(([, value]) => !value.active);
      if (!removable) throw new Error('Provider concurrency limit reached');
      providerStates.delete(removable[0]);
    }
    state = { until: 0, active: 0 };
    providerStates.set(key, state);
  }
  if (state.until > Date.now()) throw new Error('Provider temporarily cooling down');
  const maxConcurrent = Math.max(1, Math.min(16, options.maxConcurrent ?? 4));
  if (state.active >= maxConcurrent) throw new Error('Provider concurrency limit reached');
  state.active++;
  try {
    return await load();
  } catch (error) {
    state.until = Date.now() + Math.max(1000, Math.min(86400_000, options.cooldownMs ?? 60_000));
    throw error;
  } finally {
    state.active--;
  }
}

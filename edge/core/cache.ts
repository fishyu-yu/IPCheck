// Cache only provider results. Never cache visitor responses, browser data or probe results.
const entries = new Map<string, { expires: number; value: unknown }>();
export async function cached<T>(
  key: string,
  ttl: number | ((value: T) => number),
  load: () => Promise<T>,
  valid: (value: T) => boolean = () => true,
): Promise<T> {
  const now = Date.now();
  const item = entries.get(key);
  if (item && item.expires > now) return item.value as T;
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
  const request = new Request('https://provider-cache.invalid/' + digest);
  const cache = (globalThis.caches as (CacheStorage & { default?: Cache }) | undefined)?.default;
  try {
    const hit = await cache?.match(request);
    if (hit) return (await hit.json()) as T;
  } catch {
    /* Cache API is optional. */
  }
  const value = await load();
  if (!valid(value)) return value;
  const seconds = typeof ttl === 'function' ? ttl(value) : ttl;
  if (seconds <= 0) return value;
  if (entries.size >= 500) entries.delete(entries.keys().next().value!);
  entries.set(key, { expires: now + seconds * 1000, value });
  try {
    await cache?.put(
      request,
      new Response(JSON.stringify(value), {
        headers: { 'Cache-Control': `max-age=${seconds}`, 'Content-Type': 'application/json' },
      }),
    );
  } catch {
    /* Optional cache failure must not fail lookup. */
  }
  return value;
}

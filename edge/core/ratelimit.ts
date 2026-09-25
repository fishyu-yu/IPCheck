import type { RateBinding } from './contracts';
const buckets = new Map<string, { count: number; expires: number }>();
let salt: string | undefined;
const active = new Map<string, number>();
async function privateKey(ip: string) {
  salt ??= crypto.randomUUID();
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ip))),
  )
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}
export async function acquireProbe(ip: string): Promise<(() => void) | null> {
  const now = Date.now();
  for (const [key, expiry] of active) if (expiry < now) active.delete(key);
  const key = await privateKey(ip);
  if (active.has(key) || active.size >= 1000) return null;
  active.set(key, now + 30000);
  return () => {
    active.delete(key);
  };
}
export async function rateLimit(
  ip: string,
  kind: 'query' | 'probe',
  binding?: RateBinding,
  now = Date.now(),
): Promise<boolean> {
  salt ??= crypto.randomUUID();
  // Ephemeral salt plus minute window prevents persistent address identifiers.
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(salt + Math.floor(now / 60000) + ip),
  );
  const key =
    kind +
    ':' +
    Array.from(new Uint8Array(hash))
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
  // Native bindings need a stable per-minute key across isolates; hash without the isolate salt.
  if (binding) {
    const stable = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(Math.floor(now / 60000) + ':' + ip),
    );
    return (
      await binding.limit({
        key:
          kind +
          ':' +
          Array.from(new Uint8Array(stable))
            .map((n) => n.toString(16).padStart(2, '0'))
            .join(''),
      })
    ).success;
  }
  for (const [k, v] of buckets) if (v.expires <= now) buckets.delete(k);
  if (!buckets.has(key) && buckets.size >= 10000) return false;
  const b = buckets.get(key) || { count: 0, expires: now + 60000 };
  b.count++;
  buckets.set(key, b);
  return b.count <= (kind === 'probe' ? 10 : 60);
}

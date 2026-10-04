import ipaddr from 'ipaddr.js';
import { z } from 'zod';
import vpnSnapshot from './data/vpn.json';
import cloudSnapshot from './data/google-cloud.json';
import { cached } from '../../edge/core/cache';
import { publicIp } from '../../edge/core/security';
import type { PurityFeedEvidence, PurityInput, RiskSignal } from '../../src/types';

type Kind = 'vpn' | 'google-cloud';
const sources = {
  vpn: {
    source: 'X4B VPN ranges',
    url: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt',
    copyright: 'Copyright (c) 2024 X4B (Mathew Heard)',
    license: 'MIT',
    maxAge: 7 * 86400_000,
  },
  'google-cloud': {
    source: 'Google Cloud public ranges',
    url: 'https://www.gstatic.com/ipranges/cloud.json',
    copyright: 'Public IP range data published by Google Cloud',
    license: 'Official public network range feed',
    maxAge: 30 * 86400_000,
  },
} as const;
const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.enum(['vpn', 'google-cloud']),
  source: z.string(),
  url: z.string(),
  copyright: z.string(),
  license: z.string(),
  verifiedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  ranges: z.array(z.string()).min(10).max(50000),
  intervals4: z
    .array(z.tuple([z.number().int().min(0).max(4294967295), z.number().int().min(0).max(4294967295)]))
    .max(50000),
  intervals6: z
    .array(z.tuple([z.string().regex(/^[a-f0-9]{1,32}$/), z.string().regex(/^[a-f0-9]{1,32}$/)]))
    .max(50000),
});
type Snapshot = z.infer<typeof snapshotSchema>;
type Feed = {
  snapshot: Snapshot | null;
  origin: 'live' | 'snapshot';
  warnings: string[];
};
type FeedEvidence = PurityFeedEvidence & {
  fetchedAt?: string;
  expiresAt?: string;
  origin?: 'live' | 'snapshot';
  status?: 'available' | 'unavailable' | 'stale' | 'unsupported';
};
const compiled = new WeakMap<Snapshot, [bigint, bigint][]>();
const local = new Map<Kind, { until: number; feed: Feed }>();
const flights = new Map<Kind, Promise<Feed>>();

function integer(bytes: number[]): bigint {
  return bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
}

function canonicalCidr(value: string, kind: Kind): string {
  if (!value.includes(':')) {
    const parts = value.split('/');
    if (parts.length !== 2 || !/^(?:[0-9]|[12][0-9]|3[0-2])$/.test(parts[1]))
      throw new Error('Invalid IPv4 prefix');
    const octets = parts[0].split('.');
    if (
      octets.length !== 4 ||
      octets.some((part) => !/^(?:0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255)
    )
      throw new Error('Invalid IPv4 address');
    const prefix = Number(parts[1]);
    if (prefix < 8) throw new Error('Unexpected broad prefix');
    const size = 2 ** (32 - prefix);
    const first = Math.floor(octets.reduce((value, byte) => value * 256 + Number(byte), 0) / size) * size;
    return (
      [
        Math.floor(first / 16777216),
        Math.floor(first / 65536) % 256,
        Math.floor(first / 256) % 256,
        first % 256,
      ].join('.') +
      '/' +
      prefix
    );
  }
  const [address, prefix] = ipaddr.parseCIDR(value);
  if (prefix < (address.kind() === 'ipv4' ? 8 : 16)) throw new Error('Unexpected broad prefix');
  if (kind === 'vpn' && address.kind() !== 'ipv4') throw new Error('Unexpected VPN family');
  const bytes = address.toByteArray();
  for (let bit = prefix; bit < bytes.length * 8; bit++) bytes[bit >> 3] &= ~(1 << (7 - (bit & 7)));
  return ipaddr.fromByteArray(bytes).toString() + '/' + prefix;
}

function expiration(snapshot: Snapshot): number {
  const age = sources[snapshot.kind].maxAge;
  return Math.min(
    Date.parse(snapshot.verifiedAt) + age,
    snapshot.publishedAt ? Date.parse(snapshot.publishedAt) + age : Infinity,
  );
}

function isCurrent(snapshot: Snapshot): boolean {
  const now = Date.now();
  return (
    Date.parse(snapshot.verifiedAt) <= now + 300_000 &&
    (!snapshot.publishedAt || Date.parse(snapshot.publishedAt) <= now + 300_000) &&
    expiration(snapshot) > now
  );
}

async function sha256(text: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function validateSnapshot(raw: unknown, kind: Kind): Promise<Snapshot> {
  const snapshot = snapshotSchema.parse(raw);
  const source = sources[kind];
  if (snapshot.kind !== kind || snapshot.source !== source.source || snapshot.url !== source.url)
    throw new Error('Incorrect snapshot provenance');
  // The updater canonicalizes and precompiles shipped prefixes. Verify their digest
  // without reparsing thousands of CIDRs on a worker's first request.
  const { ranges, intervals4, intervals6 } = snapshot;
  if ((await sha256(JSON.stringify({ ranges, intervals4, intervals6 }))) !== snapshot.sha256)
    throw new Error('Invalid snapshot integrity');
  return snapshot;
}

function intervals(ranges: string[], family: 'ipv4' | 'ipv6'): [number, number][] | [string, string][] {
  if (family === 'ipv4') {
    const values: [number, number][] = ranges
      .filter((cidr) => !cidr.includes(':'))
      .map((cidr): [number, number] => {
        const [ip, prefix] = cidr.split('/');
        const first = ip.split('.').reduce((value, byte) => value * 256 + Number(byte), 0);
        return [first, first + 2 ** (32 - Number(prefix)) - 1];
      })
      .sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [first, last] of values) {
      const previous = merged.at(-1);
      if (previous && first <= previous[1] + 1) previous[1] = Math.max(previous[1], last);
      else merged.push([first, last]);
    }
    return merged;
  }
  const values = ranges
    .filter((cidr) => cidr.includes(':'))
    .flatMap((cidr): [bigint, bigint][] => {
      const [address, prefix] = ipaddr.parseCIDR(cidr);
      if (address.kind() !== family) return [];
      const bits = 128;
      const first = integer(address.toByteArray());
      return [[first, first + (1n << BigInt(bits - prefix)) - 1n]];
    })
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const merged: [bigint, bigint][] = [];
  for (const [first, last] of values) {
    const previous = merged.at(-1);
    if (previous && first <= previous[1] + 1n) previous[1] = previous[1] > last ? previous[1] : last;
    else merged.push([first, last]);
  }
  return merged.map(([first, last]) => [first.toString(16), last.toString(16)]);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(4500) });
  if (!response.ok) throw new Error('Upstream unavailable');
  if (Number(response.headers.get('content-length')) > 2_000_000) throw new Error('Dataset too large');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty dataset');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let result = '';
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new Error('Dataset too large');
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function download(kind: Kind): Promise<Snapshot> {
  const text = await fetchText(sources[kind].url);
  let ranges: string[];
  let publishedAt: string | null = null;
  if (kind === 'vpn') {
    ranges = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } else {
    const cloud = z
      .object({
        creationTime: z.string(),
        prefixes: z
          .array(
            z.object({
              ipv4Prefix: z.string().optional(),
              ipv6Prefix: z.string().optional(),
              service: z.literal('Google Cloud'),
            }),
          )
          .min(10)
          .max(50000),
      })
      .parse(JSON.parse(text));
    publishedAt = new Date(
      /(?:Z|[+-]\d\d:\d\d)$/.test(cloud.creationTime) ? cloud.creationTime : cloud.creationTime + 'Z',
    ).toISOString();
    ranges = cloud.prefixes.map((row) => {
      if (Boolean(row.ipv4Prefix) === Boolean(row.ipv6Prefix)) throw new Error('Invalid Cloud prefix');
      if (row.ipv4Prefix?.includes(':') || (row.ipv6Prefix && !row.ipv6Prefix.includes(':')))
        throw new Error('Incorrect Cloud prefix family');
      return row.ipv4Prefix ?? row.ipv6Prefix!;
    });
  }
  ranges = [...new Set(ranges.map((cidr) => canonicalCidr(cidr, kind)))].sort();
  const intervals4 = intervals(ranges, 'ipv4');
  const intervals6 = intervals(ranges, 'ipv6');
  const snapshot = snapshotSchema.parse({
    schemaVersion: 1,
    kind,
    ...sources[kind],
    verifiedAt: new Date().toISOString(),
    publishedAt,
    sha256: await sha256(JSON.stringify({ ranges, intervals4, intervals6 })),
    ranges,
    intervals4,
    intervals6,
  });
  if (!isCurrent(snapshot)) throw new Error('Stale dataset');
  return snapshot;
}

const bundled = new Map<Kind, Promise<Snapshot | null>>();
function bundledFeed(kind: Kind): Promise<Snapshot | null> {
  let promise = bundled.get(kind);
  if (!promise) {
    promise = validateSnapshot(kind === 'vpn' ? vpnSnapshot : cloudSnapshot, kind).catch(() => null);
    bundled.set(kind, promise);
  }
  return promise;
}

async function loadFeed(kind: Kind, refresh: boolean): Promise<Feed> {
  const fallback = await bundledFeed(kind);
  if (!refresh) return { snapshot: fallback, origin: 'snapshot', warnings: [] };
  const hit = local.get(kind);
  if (hit && hit.until > Date.now()) return hit.feed;
  const pending = flights.get(kind);
  if (pending) return pending;
  const task = cached<Feed>(
    'purity:network:v1:' + kind + ':' + (fallback ? fallback.sha256 + ':' + fallback.verifiedAt : 'missing'),
    (feed) => (feed.warnings.length ? 3600 : 21600),
    async () => {
      try {
        return { snapshot: await download(kind), origin: 'live', warnings: [] };
      } catch {
        const previous = hit?.feed.snapshot;
        const snapshot = previous && isCurrent(previous) ? previous : fallback;
        return {
          snapshot,
          origin: previous && snapshot === previous ? hit!.feed.origin : 'snapshot',
          warnings: [sources[kind].source + ' refresh unavailable; using local snapshot if valid.'],
        };
      }
    },
  );
  flights.set(kind, task);
  try {
    const feed = await task;
    local.set(kind, {
      until: Date.now() + (feed.warnings.length ? 3600_000 : 21600_000),
      feed,
    });
    return feed;
  } finally {
    flights.delete(kind);
  }
}

function contains(snapshot: Snapshot, ip: string): boolean {
  const address = ipaddr.parse(ip);
  // Premerged numeric intervals are directly usable for IPv4. IPv6 is compiled
  // once; BigInt is necessary to preserve every bit of a 128-bit address.
  let index: [number, number][] | [bigint, bigint][];
  let value: number | bigint;
  if (address.kind() === 'ipv4') {
    index = snapshot.intervals4;
    value = address.toByteArray().reduce((value, byte) => value * 256 + byte, 0);
  } else {
    index =
      compiled.get(snapshot) ??
      snapshot.intervals6.map(([first, last]) => [BigInt('0x' + first), BigInt('0x' + last)]);
    compiled.set(snapshot, index as [bigint, bigint][]);
    value = integer(address.toByteArray());
  }
  let lower = 0;
  let upper = index.length - 1;
  while (lower <= upper) {
    const middle = (lower + upper) >> 1;
    const [first, last] = index[middle];
    if (value < first) upper = middle - 1;
    else if (value > last) lower = middle + 1;
    else return true;
  }
  return false;
}

/** Local, positive-only network membership. A feed miss never establishes VPN=false. */
export async function collectNetworkPurity(
  ip: string,
  options: { refresh?: boolean } = {},
): Promise<Partial<PurityInput>> {
  if (!publicIp(ip)) throw new Error('Only public IP addresses can be classified');
  const kinds: Kind[] = ipaddr.parse(ip).kind() === 'ipv4' ? ['vpn', 'google-cloud'] : ['google-cloud'];
  const feeds: FeedEvidence[] = [];
  const signals: RiskSignal[] = [];
  const warnings: string[] = [];
  let companyType: PurityInput['companyType'];
  await Promise.all(
    kinds.map(async (kind) => {
      const feed = await loadFeed(kind, options.refresh !== false);
      const snapshot = feed.snapshot;
      const current = snapshot && isCurrent(snapshot);
      feeds.push({
        source: sources[kind].source,
        url: sources[kind].url,
        checked: Boolean(current),
        updatedAt: snapshot?.publishedAt ?? null,
        fetchedAt: snapshot?.verifiedAt,
        expiresAt: snapshot ? new Date(expiration(snapshot)).toISOString() : undefined,
        origin: feed.origin,
        status: current ? 'available' : snapshot ? 'stale' : 'unavailable',
        copyright: sources[kind].copyright,
      });
      warnings.push(...feed.warnings);
      if (!current) {
        warnings.push(
          sources[kind].source + ' local snapshot expired or invalid; classification is unknown.',
        );
        return;
      }
      if (!contains(snapshot, ip)) return;
      if (kind === 'vpn') {
        signals.push({
          key: 'vpn',
          value: true,
          source: sources[kind].source,
          confidence: 0.6,
          detection: 'Estimated / Unsupported',
        });
        warnings.push(
          'VPN prefix membership is inferred from a public network list; it does not establish current use or abuse.',
        );
      } else {
        companyType = { type: 'hosting', source: sources[kind].source, inferred: false };
        signals.push({
          key: 'hosting',
          value: true,
          source: sources[kind].source,
          confidence: 1,
          detection: 'Provider Detection',
        });
      }
    }),
  );
  // Stable output order makes cached results and diagnostics reproducible.
  feeds.sort((a, b) => a.source.localeCompare(b.source));
  signals.sort((a, b) => a.key.localeCompare(b.key));
  return { feeds, signals, warnings: [...new Set(warnings)].sort(), companyType };
}

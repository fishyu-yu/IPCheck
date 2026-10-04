import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ipaddr from 'ipaddr.js';

// Public datasets are downloaded in full. No queried visitor IP is sent upstream.
const directory = fileURLToPath(new URL('../api/purity/data/', import.meta.url));
const sources = [
  {
    kind: 'vpn',
    source: 'X4B VPN ranges',
    url: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt',
    copyright: 'Copyright (c) 2024 X4B (Mathew Heard)',
    license: 'MIT',
  },
  {
    kind: 'google-cloud',
    source: 'Google Cloud public ranges',
    url: 'https://www.gstatic.com/ipranges/cloud.json',
    copyright: 'Public IP range data published by Google Cloud',
    license: 'Official public network range feed',
  },
];

function canonicalCidr(value, kind) {
  const [address, prefix] = ipaddr.parseCIDR(value);
  if (prefix < (address.kind() === 'ipv4' ? 8 : 16)) throw new Error('Unexpected broad prefix');
  if (kind === 'vpn' && address.kind() !== 'ipv4') throw new Error('Unexpected VPN address family');
  const bytes = address.toByteArray();
  for (let bit = prefix; bit < bytes.length * 8; bit++) bytes[bit >> 3] &= ~(1 << (7 - (bit & 7)));
  return ipaddr.fromByteArray(bytes).toString() + '/' + prefix;
}

function intervals(ranges, family) {
  const values = ranges
    .flatMap((cidr) => {
      const [address, prefix] = ipaddr.parseCIDR(cidr);
      if (address.kind() !== family) return [];
      const bits = address.kind() === 'ipv4' ? 32 : 128;
      const first = address.toByteArray().reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
      return [[first, first + (1n << BigInt(bits - prefix)) - 1n]];
    })
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const merged = [];
  for (const [first, last] of values) {
    const previous = merged.at(-1);
    if (previous && first <= previous[1] + 1n) previous[1] = previous[1] > last ? previous[1] : last;
    else merged.push([first, last]);
  }
  return merged.map(([first, last]) =>
    family === 'ipv4' ? [Number(first), Number(last)] : [first.toString(16), last.toString(16)],
  );
}

const snapshots = await Promise.all(
  sources.map(async (source) => {
    const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(source.source + ' unavailable: ' + response.status);
    const text = await response.text();
    if (Buffer.byteLength(text) > 2_000_000) throw new Error('Dataset exceeds size bound');
    const verifiedAt = new Date().toISOString();
    let publishedAt = null;
    let ranges;
    if (source.kind === 'vpn') {
      ranges = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    } else {
      const cloud = JSON.parse(text);
      // Google publishes UTC timestamps without a trailing offset.
      publishedAt = new Date(
        /(?:Z|[+-]\d\d:\d\d)$/.test(cloud.creationTime) ? cloud.creationTime : cloud.creationTime + 'Z',
      ).toISOString();
      if (
        Date.parse(publishedAt) > Date.now() + 300000 ||
        Date.parse(publishedAt) < Date.now() - 30 * 86400000
      )
        throw new Error('Google Cloud publication date is stale or invalid');
      ranges = cloud.prefixes.map((row) => {
        if (row.service !== 'Google Cloud' || Boolean(row.ipv4Prefix) === Boolean(row.ipv6Prefix))
          throw new Error('Unexpected Google Cloud row');
        return row.ipv4Prefix ?? row.ipv6Prefix;
      });
    }
    ranges = [...new Set(ranges.map((cidr) => canonicalCidr(cidr, source.kind)))].sort();
    if (ranges.length < 10 || ranges.length > 50000) throw new Error('Unexpected dataset size');
    const intervals4 = intervals(ranges, 'ipv4');
    const intervals6 = intervals(ranges, 'ipv6');
    return {
      schemaVersion: 1,
      ...source,
      verifiedAt,
      publishedAt,
      sha256: createHash('sha256').update(JSON.stringify({ ranges, intervals4, intervals6 })).digest('hex'),
      ranges,
      intervals4,
      intervals6,
    };
  }),
);

// Only write after every download passes validation, preserving good snapshots on failure.
await mkdir(directory, { recursive: true });
for (const snapshot of snapshots) {
  await writeFile(
    new URL('../api/purity/data/' + snapshot.kind + '.json', import.meta.url),
    JSON.stringify(snapshot, null, 2) + '\n',
  );
  console.log(snapshot.source + ': ' + snapshot.ranges.length + ' prefixes, verified ' + snapshot.verifiedAt);
}

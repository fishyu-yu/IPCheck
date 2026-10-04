import ipaddr from 'ipaddr.js';
import { z } from 'zod';
import type { Env } from '../../edge/core/contracts';
import { cached } from '../../edge/core/cache';
import { fetchJson, ipSchema, publicIp } from '../../edge/core/security';
import type {
  IPInfo,
  NetworkCategory,
  PurityFeedEvidence,
  PurityInput,
  PurityNeighborhood,
  PurityTypeEvidence,
  RiskKey,
  RiskSignal,
} from '../../src/types';
import { lookupIp } from '../ip/service';
import { geoProviders } from '../lookup/providers';
import { AbuseProvider, IpqsProvider, riskLookup } from '../risk/providers';
import { coalesced, protectedLookup } from './runtime';
import { collectNetworkPurity } from './network-feeds';
import { proxycheckLookup } from './proxycheck';
import { ipqueryLookup } from './ipquery';

const urls = {
  drop4: 'https://www.spamhaus.org/drop/drop_v4.json',
  drop6: 'https://www.spamhaus.org/drop/drop_v6.json',
  feodo: 'https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json',
  tor: 'https://check.torproject.org/torbulkexitlist',
  cins: 'https://cinsscore.com/list/ci-badguys.txt',
} as const;
type FeedData = {
  evidence: PurityFeedEvidence;
  addresses: string[];
  ranges: string[];
  warnings: string[];
  validUntil?: number;
};
type FeedIndex = {
  addresses: Set<string>;
  neighbors: Map<string, number>;
  ipv4: boolean;
  ipv6: boolean;
  ranges: ReturnType<typeof ipaddr.parseCIDR>[];
};
type ParsedFeed = Pick<FeedData, 'addresses' | 'ranges'> & { updatedAt?: string; copyright?: string };
const feedIndexes = new WeakMap<FeedData, FeedIndex>();
// Only five fixed feed keys can enter this map. Target-IP cache churn must never
// evict a feed and trigger an early download, particularly Spamhaus's hourly limit.
const feedMemory = new Map<keyof typeof urls, { expires: number; value: FeedData }>();

function indexed(feed: FeedData): FeedIndex {
  const existing = feedIndexes.get(feed);
  if (existing) return existing;
  const addresses = new Set(feed.addresses);
  const neighbors = new Map<string, number>();
  let ipv4 = false,
    ipv6 = false;
  for (const address of addresses) {
    if (address.includes(':')) ipv6 = true;
    else {
      ipv4 = true;
      const subnet = address.split('.').slice(0, 3).join('.');
      neighbors.set(subnet, (neighbors.get(subnet) || 0) + 1);
    }
  }
  const index = {
    addresses,
    neighbors,
    ipv4,
    ipv6,
    ranges: feed.ranges.map((range) => ipaddr.parseCIDR(range)),
  };
  feedIndexes.set(feed, index);
  return index;
}

function neighborCount(index: FeedIndex, ip: string): number {
  const subnet = ip.split('.').slice(0, 3).join('.');
  return Math.max(0, (index.neighbors.get(subnet) || 0) - Number(index.addresses.has(ip)));
}

function freshFeed(feed: FeedData): FeedData {
  if (!feed.evidence.checked || !feed.validUntil || feed.validUntil >= Date.now()) return feed;
  // Keep the original download cooldown. Expired evidence must not cause an
  // early redownload, especially for Spamhaus's minimum one-hour interval.
  return {
    evidence: { ...feed.evidence, checked: false, status: 'stale' },
    addresses: [],
    ranges: [],
    warnings: [feed.evidence.source + ' cached snapshot expired; absence remains unknown'],
  };
}

async function fingerprint(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchText(url: string): Promise<{ text: string; modified: string | null }> {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(4500) });
  if (!response.ok) throw new Error('Upstream unavailable');
  const declared = Number(response.headers.get('content-length'));
  if (declared > 2_000_000) throw new Error('Upstream response too large');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty upstream response');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '',
    size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new Error('Upstream response too large');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const modified = response.headers.get('last-modified');
  return {
    text,
    modified: modified && Number.isFinite(Date.parse(modified)) ? new Date(modified).toISOString() : null,
  };
}

function canonicalIp(value: string): string {
  if (!ipSchema.safeParse(value).success) throw new Error('Malformed IP address');
  return value.includes(':') ? ipaddr.parse(value).toString() : value;
}

function matchesCidr(ip: string, cidr: string): boolean {
  const address = ipaddr.parse(ip);
  const range = ipaddr.parseCIDR(cidr);
  return address.kind() === range[0].kind() && address.match(range);
}

function parseDrop(text: string, version: 4 | 6): ParsedFeed {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as unknown);
  // Spamhaus publishes JSONL, with a metadata object as the last line.
  const trailer = z
    .object({
      timestamp: z.number().int().positive(),
      copyright: z.string().min(1),
    })
    .parse(rows.pop());
  const date = new Date(trailer.timestamp * 1000);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid feed timestamp');
  if (date.getTime() > Date.now() + 300_000 || date.getTime() < Date.now() - 48 * 3600_000)
    throw new Error('Stale or future feed timestamp');
  if (!rows.length) throw new Error('Empty DROP feed');
  const ranges = rows.map((row) => {
    const cidr = z.object({ cidr: z.string() }).parse(row).cidr;
    const parsed = ipaddr.parseCIDR(cidr);
    if (parsed[0].kind() !== (version === 4 ? 'ipv4' : 'ipv6')) throw new Error('Wrong CIDR family');
    return cidr;
  });
  return {
    ranges: [...new Set(ranges)],
    addresses: [],
    updatedAt: date.toISOString(),
    copyright: trailer.copyright,
  };
}

function parseFeodo(text: string): ParsedFeed {
  // The recommended feed contains online or recently observed botnet C2 addresses.
  // It can legitimately be an empty JSON array; an empty HTTP body cannot.
  const rows = z
    .array(
      z.object({
        ip_address: z.string(),
        status: z.enum(['online', 'offline']),
        last_online: z.string().nullable(),
      }),
    )
    .parse(JSON.parse(text));
  const now = Date.now();
  const addresses = rows.flatMap((row) => {
    const ip = canonicalIp(row.ip_address);
    // Feodo's timestamps without an offset are UTC, independent of the host timezone.
    const recorded = row.last_online?.trim();
    const lastOnline =
      recorded === undefined
        ? 0
        : Date.parse(
            /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(recorded)
              ? recorded.replace(' ', 'T') + 'Z'
              : recorded,
          );
    if (!Number.isFinite(lastOnline)) throw new Error('Invalid last-online timestamp');
    if (lastOnline > now + 300_000) throw new Error('Future last-online timestamp');
    const recent = lastOnline <= now + 300_000 && lastOnline >= now - 86400_000;
    return row.status === 'online' || recent ? [ip] : [];
  });
  return { addresses: [...new Set(addresses)], ranges: [] };
}

function parseIpList(text: string): ParsedFeed {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  // A blank or comment-only response cannot establish a negative finding.
  if (!lines.length) throw new Error('Empty IP feed');
  return { addresses: [...new Set(lines.map(canonicalIp))], ranges: [] };
}

async function loadFeed(kind: keyof typeof urls): Promise<FeedData> {
  const local = feedMemory.get(kind);
  if (local && local.expires > Date.now()) return freshFeed(local.value);
  const source = kind.startsWith('drop')
    ? 'Spamhaus Project DROP'
    : kind === 'feodo'
      ? 'abuse.ch Feodo Tracker'
      : kind === 'cins'
        ? 'CINS Army'
        : 'Tor Project exit list';
  const url = urls[kind];
  const ttl = kind === 'feodo' ? 900 : 3600;
  // Even a failed Spamhaus fetch must respect the minimum one-hour fetch interval.
  const failureTtl = kind.startsWith('drop') ? 3600 : kind === 'tor' || kind === 'cins' ? 300 : 60;
  const key = 'purity:feed:v2:' + kind;
  return coalesced(key, async () => {
    const value = await cached(
      key,
      (value: FeedData) => (value.evidence.checked ? ttl : failureTtl),
      async () => {
        let modifiedAt: string | null = null;
        try {
          const { text, modified } = await fetchText(url);
          modifiedAt = modified;
          if (
            kind === 'feodo' &&
            modified &&
            (Date.parse(modified) < Date.now() - 86400_000 || Date.parse(modified) > Date.now() + 300_000)
          )
            throw new Error('Stale or future Feodo feed');
          if (
            kind === 'cins' &&
            (!modified ||
              Date.parse(modified) < Date.now() - 86400_000 ||
              Date.parse(modified) > Date.now() + 300_000)
          )
            throw new Error('Missing, stale or future CINS feed timestamp');
          const data = kind.startsWith('drop')
            ? parseDrop(text, kind === 'drop4' ? 4 : 6)
            : kind === 'feodo'
              ? parseFeodo(text)
              : parseIpList(text);
          if (kind === 'cins' && data.addresses.length > 15000)
            throw new Error('CINS feed exceeds documented address cap');
          const published = data.updatedAt || modified;
          const fetchedAt = new Date().toISOString();
          const validUntil =
            published && kind !== 'tor'
              ? Date.parse(published) + (kind.startsWith('drop') ? 48 : 24) * 3600_000
              : null;
          return {
            ...data,
            evidence: {
              source,
              url,
              checked: true,
              updatedAt: published,
              fetchedAt,
              expiresAt: new Date(Math.min(Date.now() + ttl * 1000, validUntil ?? Infinity)).toISOString(),
              origin: 'live' as const,
              status: 'available' as const,
              ...(data.copyright ? { copyright: data.copyright } : {}),
            },
            warnings: [],
            ...(validUntil ? { validUntil } : {}),
          };
        } catch (error) {
          return {
            evidence: {
              source,
              url,
              checked: false,
              updatedAt: modifiedAt,
              fetchedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + failureTtl * 1000).toISOString(),
              origin: 'live' as const,
              status:
                error instanceof Error && /Stale|stale|Future|future/.test(error.message)
                  ? ('stale' as const)
                  : ('unavailable' as const),
            },
            addresses: [],
            ranges: [],
            warnings: [
              source +
                ' unavailable or invalid; absence is not a negative finding' +
                (error instanceof Error && /feed timestamp|Feodo feed/.test(error.message)
                  ? ' (stale or missing update metadata)'
                  : ''),
            ],
          };
        }
      },
    );
    feedMemory.set(kind, { expires: Date.now() + (value.evidence.checked ? ttl : failureTtl) * 1000, value });
    if (value.evidence.checked) indexed(value);
    return freshFeed(value);
  });
}

function signal(key: RiskKey, value: boolean | number, source: string): RiskSignal {
  return { key, value, source, confidence: null, detection: 'Provider Detection' };
}

function inferType(name: string | undefined, source: string): PurityTypeEvidence {
  let type: NetworkCategory = 'unknown';
  if (name) {
    // Name hints describe the organization, never establish a residential endpoint.
    if (
      /\b(?:hosting|hosted|datacenter|data\s*cent[er]+|colocation|vps|iaas|cloud\s+(?:computing|services?)|digitalocean|hetzner|linode|vultr|ovh)\b|\b(?:amazon web services|microsoft azure|google cloud|alibaba cloud|tencent cloud)\b|云计算|云服务|数据中心/i.test(
        name,
      )
    )
      type = 'hosting';
    else if (/\b(?:university|college|education|academic|school)\b|大学|学院|教育网/i.test(name))
      type = 'education';
    else if (/\b(?:government|ministry|municipality|department of)\b|政府|政务/i.test(name))
      type = 'government';
    else if (
      /\b(?:telecom(?:munications)?|telekom|internet service provider|broadband|telefonica|comcast|charter|vodafone|verizon|t-mobile|chinanet|china\s+(?:unicom|mobile|telecom))\b|中国(?:电信|联通|移动|铁通)/i.test(
        name,
      )
    )
      type = 'isp';
  }
  return { type, source: 'Local name inference (' + source + ')', inferred: true };
}

const category = (value: string | null | undefined): NetworkCategory => {
  const normalized = value?.toLowerCase();
  if (normalized === 'banking') return 'business';
  return ['isp', 'hosting', 'business', 'education', 'government'].includes(normalized || '')
    ? (normalized as NetworkCategory)
    : 'unknown';
};

function companyNetworkContains(network: string, ip: string): boolean {
  try {
    if (network.includes('/')) return matchesCidr(ip, network);
    const pair = network.split(/\s+-\s+/);
    if (pair.length !== 2) return false;
    const target = ipaddr.parse(ip),
      start = ipaddr.parse(pair[0]),
      end = ipaddr.parse(pair[1]);
    if (target.kind() !== start.kind() || target.kind() !== end.kind()) return false;
    const number = (address: ipaddr.IPv4 | ipaddr.IPv6) =>
      address.toByteArray().reduce((result, byte) => (result << 8n) + BigInt(byte), 0n);
    return number(start) <= number(target) && number(target) <= number(end);
  } catch {
    return false;
  }
}

async function ipapiLookup(ip: string, key: string): Promise<Partial<PurityInput>> {
  const optionalString = z.string().nullish();
  const metadata = z.object({ type: optionalString, network: optionalString, abuser_score: optionalString });
  const schema = z.object({
    ip: z.string(),
    asn: metadata.nullish(),
    company: metadata.nullish(),
    is_vpn: z.boolean().nullish(),
    is_proxy: z.boolean().nullish(),
    is_tor: z.boolean().nullish(),
    is_datacenter: z.boolean().nullish(),
    is_abuser: z.boolean().nullish(),
  });
  const credentialProfile = await fingerprint(key);
  const cacheKey = 'purity:ipapi:v2:' + credentialProfile + ':' + ip;
  return coalesced(cacheKey, () =>
    cached(cacheKey, 3600, () =>
      protectedLookup('ipapi:' + credentialProfile, async () => {
        const data = schema.parse(
          await fetchJson('https://api.ipapi.is', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: ip, key }),
          }),
        );
        if (canonicalIp(data.ip) !== ip) throw new Error('Mismatched IP response');
        const signals: RiskSignal[] = [];
        for (const [name, value] of Object.entries({
          vpn: data.is_vpn,
          proxy: data.is_proxy,
          tor: data.is_tor,
          datacenter: data.is_datacenter,
          abuse: data.is_abuser,
        })) {
          if (typeof value === 'boolean') signals.push(signal(name as RiskKey, value, 'ipapi.is'));
        }
        const input: Partial<PurityInput> = { signals, warnings: [] };
        if (data.asn?.type)
          input.asnType = {
            type: category(data.asn.type),
            source: 'ipapi.is ASN classification',
            inferred: false,
          };
        if (data.company?.type)
          input.companyType = {
            type: category(data.company.type),
            source: 'ipapi.is company classification',
            inferred: false,
          };
        const score = data.company?.abuser_score?.match(/^\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*(?:\([^)]*\))?\s*$/);
        if (score && data.company?.network && companyNetworkContains(data.company.network, ip)) {
          input.neighborhood = {
            cidr: data.company.network,
            activeBadNeighbors: null,
            abuseDensity: Number(score[1]),
            scope: 'company-network',
            source: 'ipapi.is company network abuse fraction',
          };
        }
        if (!input.asnType && !input.companyType && !signals.length && !input.neighborhood)
          throw new Error('No keyed intelligence fields returned');
        return input;
      }),
    ),
  );
}

export async function collectPurity(ip: string, env: Env): Promise<PurityInput> {
  const input: PurityInput = { signals: [], feeds: [], warnings: [] };
  if (!publicIp(ip)) {
    input.warnings.push('Purity assessment requires a public unicast address');
    return input;
  }
  ip = canonicalIp(ip);
  const feedsEnabled = env.PURITY_PUBLIC_FEEDS !== 'off';
  const profile = await fingerprint(
    JSON.stringify([
      env.IPINFO_TOKEN || '',
      env.GEO_FREE_PROVIDER || '',
      env.IPQS_KEY || '',
      env.ABUSEIPDB_KEY || '',
    ]),
  );
  const guardedGeo = geoProviders(env).map((provider) => ({
    name: provider.name,
    lookup: (target: string) =>
      protectedLookup('geo:' + provider.name + ':' + profile, () => provider.lookup(target)),
  }));
  const guardedRisk = [
    ...(env.IPQS_KEY ? [new IpqsProvider(env.IPQS_KEY)] : []),
    ...(env.ABUSEIPDB_KEY ? [new AbuseProvider(env.ABUSEIPDB_KEY)] : []),
  ].map((provider) => ({
    name: provider.name,
    lookup: (target: string) =>
      protectedLookup('risk:' + provider.name + ':' + profile, async () => {
        const signals = await provider.lookup(target);
        if (!signals.length) throw new Error('No intelligence fields returned');
        return signals;
      }),
  }));
  const geoKey = 'purity:geo:v2:' + profile + ':' + ip;
  const riskKey = 'purity:risk:v2:' + profile + ':' + ip;
  const tasks = await Promise.allSettled([
    coalesced(geoKey, () =>
      cached(
        geoKey,
        86400,
        () => lookupIp(ip, env, guardedGeo),
        (value) => value.sources.length > 0,
      ),
    ),
    feedsEnabled ? loadFeed(ip.includes(':') ? 'drop6' : 'drop4') : Promise.resolve(null),
    feedsEnabled ? loadFeed('feodo') : Promise.resolve(null),
    feedsEnabled ? loadFeed('tor') : Promise.resolve(null),
    env.IPAPI_KEY ? ipapiLookup(ip, env.IPAPI_KEY) : Promise.resolve(null),
    env.IPQS_KEY || env.ABUSEIPDB_KEY
      ? coalesced(riskKey, () =>
          cached(
            riskKey,
            3600,
            () => riskLookup(ip, env, guardedRisk),
            (value) => value.checked > 0 && !value.warnings.length,
          ),
        )
      : Promise.resolve(null),
    collectNetworkPurity(ip, { refresh: feedsEnabled }),
    env.PROXYCHECK_KEY ? proxycheckLookup(ip, env.PROXYCHECK_KEY) : Promise.resolve(null),
    env.PURITY_IPQUERY !== 'off' ? ipqueryLookup(ip) : Promise.resolve(null),
  ] as const);
  const geo = tasks[0];
  if (geo.status === 'fulfilled' && geo.value) {
    const info = geo.value as IPInfo;
    input.asnType =
      info.asnType ||
      inferType(
        info.asnName || info.isp,
        info.fieldSources?.asnName || info.fieldSources?.isp || info.sources.join(', ') || 'no ASN name',
      );
    input.companyType =
      info.companyType ||
      inferType(
        info.organization,
        info.fieldSources?.organization || info.sources.join(', ') || 'no organization name',
      );
    input.warnings.push(...info.warnings);
  } else input.warnings.push('Organization metadata unavailable; name classification unknown');
  const drop = tasks[1],
    feodo = tasks[2],
    tor = tasks[3];
  for (const task of [drop, feodo, tor]) {
    if (task.status === 'fulfilled' && task.value) {
      const feed = task.value as FeedData;
      input.feeds.push({ ...feed.evidence });
      input.warnings.push(...feed.warnings);
    }
  }
  if (drop.status === 'fulfilled' && drop.value && (drop.value as FeedData).evidence.checked) {
    const feed = drop.value as FeedData;
    const address = ipaddr.parse(ip);
    input.signals.push(
      signal(
        'blacklist',
        indexed(feed).ranges.some((range) => address.kind() === range[0].kind() && address.match(range)),
        feed.evidence.source,
      ),
    );
  }
  if (feodo.status === 'fulfilled' && feodo.value && (feodo.value as FeedData).evidence.checked) {
    const feed = feodo.value as FeedData;
    const index = indexed(feed);
    if (ip.includes(':') && !index.ipv6) {
      input.feeds.find((entry) => entry.url === urls.feodo)!.checked = false;
      input.feeds.find((entry) => entry.url === urls.feodo)!.status = 'unsupported';
      input.warnings.push('Feodo feed has no IPv6 coverage; IPv6 absence remains unknown');
    }
    if (index.addresses.has(ip))
      input.signals.push(
        signal('bot', true, feed.evidence.source),
        signal('abuse', true, feed.evidence.source),
      );
    if (!ip.includes(':')) {
      const cidr = ip.split('.').slice(0, 3).join('.') + '.0/24';
      const count = neighborCount(index, ip);
      input.neighborhood = {
        cidr,
        activeBadNeighbors: count,
        abuseDensity: null,
        scope: 'ipv4-/24',
        source: feed.evidence.source,
        activityCidr: cidr,
        activitySource: feed.evidence.source,
        activityKind: 'recent-c2',
      } satisfies PurityNeighborhood;
    }
  }
  const feodoCovered =
    feodo.status === 'fulfilled' &&
    feodo.value?.evidence.checked &&
    (!ip.includes(':') || indexed(feodo.value).ipv6);
  if (feedsEnabled && !feodoCovered) {
    const cins = await loadFeed('cins');
    const index = indexed(cins);
    const covered = cins.evidence.checked && (ip.includes(':') ? index.ipv6 : index.ipv4);
    input.feeds.push({
      ...cins.evidence,
      checked: covered,
      ...(cins.evidence.checked && !covered ? { status: 'unsupported' as const } : {}),
    });
    input.warnings.push(...cins.warnings);
    if (cins.evidence.checked && !covered)
      input.warnings.push('CINS Army feed has no matching IP-family coverage; absence remains unknown');
    if (covered) {
      // CINS is a current capped reputation list, not per-address last-online data.
      if (index.addresses.has(ip)) input.signals.push(signal('abuse', 0.6, cins.evidence.source));
      if (!ip.includes(':')) {
        const cidr = ip.split('.').slice(0, 3).join('.') + '.0/24';
        const count = neighborCount(index, ip);
        input.neighborhood = {
          cidr,
          activeBadNeighbors: count,
          abuseDensity: null,
          scope: 'ipv4-/24',
          source: cins.evidence.source,
          activityCidr: cidr,
          activitySource: cins.evidence.source,
          activityKind: 'threat-list',
        };
      }
      input.warnings.push(
        'CINS Army lists current reputation threats with a 15,000-IP cap; individual activity times and unlisted threats are unknown',
      );
    }
  }
  if (tor.status === 'fulfilled' && tor.value && (tor.value as FeedData).evidence.checked) {
    const feed = tor.value as FeedData;
    const index = indexed(feed);
    const match = index.addresses.has(ip);
    if (match || !ip.includes(':') || index.ipv6)
      input.signals.push(signal('tor', match, feed.evidence.source));
    else {
      const evidence = input.feeds.find((entry) => entry.url === urls.tor)!;
      evidence.checked = false;
      evidence.status = 'unsupported';
      input.warnings.push('Tor exit feed has no IPv6 coverage; IPv6 absence remains unknown');
    }
  }
  const ipapi = tasks[4];
  if (ipapi.status === 'fulfilled' && ipapi.value) {
    const data = ipapi.value as Partial<PurityInput>;
    if (data.asnType) input.asnType = data.asnType;
    if (data.companyType) input.companyType = data.companyType;
    if (data.neighborhood)
      input.neighborhood = {
        ...data.neighborhood,
        activeBadNeighbors: input.neighborhood?.activeBadNeighbors ?? null,
        activityCidr: input.neighborhood?.activityCidr,
        activitySource: input.neighborhood?.activitySource,
        activityKind: input.neighborhood?.activityKind,
      };
    input.signals.push(...(data.signals || []));
    input.warnings.push(...(data.warnings || []));
  } else if (ipapi.status === 'rejected')
    input.warnings.push('ipapi.is unavailable or returned no valid keyed intelligence; using local evidence');
  const risk = tasks[5];
  if (risk.status === 'fulfilled' && risk.value) {
    input.signals.push(...risk.value.signals);
    input.warnings.push(...risk.value.warnings);
  } else if (risk.status === 'rejected') input.warnings.push('Configured risk provider unavailable');
  for (const index of [6, 7, 8] as const) {
    const task = tasks[index];
    if (task.status === 'fulfilled' && task.value) {
      const data = task.value as Partial<PurityInput>;
      if (
        data.companyType &&
        (!input.companyType || input.companyType.inferred || input.companyType.type === 'unknown')
      )
        input.companyType = data.companyType;
      input.signals.push(...(data.signals || []));
      input.feeds.push(...(data.feeds || []));
      input.warnings.push(...(data.warnings || []));
    } else if (task.status === 'rejected') {
      input.warnings.push(
        index === 6
          ? 'Local network classification unavailable'
          : index === 7
            ? 'Proxycheck unavailable or quota exhausted; checks remain unknown.'
            : 'IPQuery unavailable or invalid; checks remain unknown.',
      );
    }
  }
  if (!env.IPAPI_KEY && (input.asnType?.inferred || input.companyType?.inferred))
    input.warnings.push(
      'ASN/company types use conservative local name inference; provider classification is unavailable',
    );
  if (!feedsEnabled) input.warnings.push('Public threat feeds disabled by deployment configuration');
  input.warnings.push(
    'Threat feeds show specific known threats only; no listing does not prove an address is safe',
  );
  input.warnings.push(
    'Neighborhood evidence counts feed-listed neighbors or reported network abuse, not generic IP liveness',
  );
  return input;
}

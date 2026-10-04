// OpenAPI payload models. Shared envelope and route descriptions are composed in openapi.ts.
const text = { type: 'string' },
  num = { type: 'number' },
  bool = { type: 'boolean' },
  nullableText = { type: ['string', 'null'] },
  nullableNum = { type: ['number', 'null'] };
const strings = { type: 'array', items: text };
const ref = (name: string) => ({ $ref: '#/components/schemas/' + name });
const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
});
export const payloadSchemas = {
  Evidence: object(
    {
      value: { type: ['string', 'boolean', 'number', 'null'] },
      source: text,
      confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 },
      detection: {
        enum: ['Real Detection', 'Provider Detection', 'Browser-side Detection', 'Estimated / Unsupported'],
      },
    },
    ['value', 'source', 'confidence', 'detection'],
  ),
  IPInfo: object(
    {
      ip: nullableText,
      version: { enum: [4, 6, null] },
      country: text,
      countryCode: text,
      region: text,
      city: text,
      postal: text,
      latitude: num,
      longitude: num,
      timezone: text,
      asn: num,
      asnName: text,
      organization: text,
      isp: text,
      prefix: text,
      reverseDns: text,
      hostingProvider: text,
      asnType: ref('PurityTypeEvidence'),
      companyType: ref('PurityTypeEvidence'),
      type: { type: 'array', items: ref('Evidence') },
      sources: strings,
      fieldSources: { type: 'object', additionalProperties: text },
      partial: bool,
      warnings: strings,
      edge: { type: 'object' },
      userAgent: text,
      detection: text,
    },
    ['ip', 'version', 'type', 'sources', 'partial', 'warnings', 'detection'],
  ),
  ASNInfo: object(
    {
      asn: num,
      organization: nullableText,
      country: nullableText,
      rir: nullableText,
      prefixCount: nullableNum,
      ipv4: strings,
      ipv6: strings,
      upstreams: { type: ['array', 'null'], items: text },
      source: text,
      partial: bool,
      warnings: strings,
    },
    ['asn', 'source', 'partial'],
  ),
  RiskSignal: {
    allOf: [
      ref('Evidence'),
      object({
        key: {
          enum: [
            'vpn',
            'proxy',
            'tor',
            'hosting',
            'datacenter',
            'bot',
            'abuse',
            'spam',
            'blacklist',
            'anonymous',
          ],
        },
      }),
    ],
  },
  RiskResult: object(
    {
      ip: text,
      score: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
      level: { enum: ['Low Risk', 'Moderate Risk', 'High Risk', 'Not checked'] },
      signals: { type: 'array', items: ref('RiskSignal') },
      checked: num,
      total: num,
      conflicts: strings,
      partial: bool,
      model: text,
      sources: strings,
      warnings: strings,
    },
    ['ip', 'score', 'level', 'signals', 'checked', 'total', 'partial'],
  ),
  PurityTypeEvidence: object(
    {
      type: { enum: ['isp', 'hosting', 'business', 'education', 'government', 'unknown'] },
      source: text,
      inferred: bool,
    },
    ['type', 'source', 'inferred'],
  ),
  PurityDimension: object(
    {
      key: { enum: ['asn', 'company', 'anonymity', 'abuse', 'neighborhood'] },
      score: { type: 'integer', minimum: 0, maximum: 100 },
      weight: { type: 'integer', minimum: 0, maximum: 100 },
      observed: bool,
      inferred: bool,
      evidence: text,
      reliability: { type: 'number', minimum: 0, maximum: 1 },
      sources: strings,
    },
    ['key', 'score', 'weight', 'observed', 'inferred', 'reliability', 'evidence', 'sources'],
  ),
  PurityFeedEvidence: object(
    {
      source: text,
      url: { type: 'string', format: 'uri' },
      checked: bool,
      updatedAt: nullableText,
      fetchedAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
      origin: { enum: ['live', 'snapshot'] },
      status: { enum: ['available', 'unavailable', 'stale', 'unsupported'] },
      copyright: text,
    },
    ['source', 'url', 'checked', 'updatedAt'],
  ),
  PurityNeighborhood: object(
    {
      cidr: nullableText,
      activityCidr: nullableText,
      activitySource: nullableText,
      activityKind: { enum: ['recent-c2', 'threat-list'] },
      activeBadNeighbors: { type: ['integer', 'null'], minimum: 0 },
      abuseDensity: { type: ['number', 'null'], minimum: 0, maximum: 1 },
      scope: { enum: ['ipv4-/24', 'company-network', 'none'] },
      source: text,
    },
    ['cidr', 'activeBadNeighbors', 'abuseDensity', 'scope', 'source'],
  ),
  PurityResult: object(
    {
      ip: text,
      score: { type: 'integer', minimum: 0, maximum: 100 },
      scoreRange: object(
        {
          min: { type: 'integer', minimum: 0, maximum: 100 },
          max: { type: 'integer', minimum: 0, maximum: 100 },
        },
        ['min', 'max'],
      ),
      recommendations: strings,
      level: { enum: ['High purity', 'Moderate purity', 'Low purity', 'Insufficient evidence'] },
      confidence: { enum: ['High', 'Medium', 'Low'] },
      coverage: { type: 'integer', minimum: 0, maximum: 100 },
      status: { enum: ['assessed', 'limited', 'insufficient'] },
      model: text,
      assessedAt: { type: 'string', format: 'date-time' },
      dimensions: { type: 'array', minItems: 5, maxItems: 5, items: ref('PurityDimension') },
      asnType: ref('PurityTypeEvidence'),
      companyType: ref('PurityTypeEvidence'),
      neighborhood: ref('PurityNeighborhood'),
      feeds: { type: 'array', items: ref('PurityFeedEvidence') },
      signals: { type: 'array', items: ref('RiskSignal') },
      conflicts: strings,
      sources: strings,
      warnings: strings,
    },
    [
      'ip',
      'score',
      'scoreRange',
      'recommendations',
      'level',
      'confidence',
      'coverage',
      'status',
      'model',
      'assessedAt',
      'dimensions',
      'asnType',
      'companyType',
      'neighborhood',
      'feeds',
      'signals',
      'conflicts',
      'sources',
      'warnings',
    ],
  ),
  PingResult: object(
    {
      supported: bool,
      success: bool,
      mode: { enum: ['http', 'tcp', 'icmp'] },
      host: text,
      port: num,
      latency: num,
      totalTime: num,
      status: num,
      server: text,
      targetIp: text,
      message: text,
      source: text,
      detection: text,
      measured: strings,
    },
    ['supported', 'mode', 'host', 'source', 'detection'],
  ),
  DNSResult: object(
    {
      name: text,
      type: text,
      status: num,
      answers: {
        type: 'array',
        items: object({ name: text, type: num, TTL: num, data: text }, ['name', 'type', 'TTL', 'data']),
      },
      source: text,
      detection: text,
    },
    ['name', 'type', 'status', 'answers', 'source', 'detection'],
  ),
  TraceResult: object(
    {
      supported: bool,
      hops: {
        type: 'array',
        items: object({
          hop: num,
          ip: nullableText,
          hostname: nullableText,
          asn: nullableNum,
          country: nullableText,
          latency: nullableNum,
        }),
      },
      source: text,
      message: text,
    },
    ['supported', 'hops', 'source'],
  ),
  DnsSession: object(
    {
      supported: bool,
      id: { type: 'string', format: 'uuid' },
      hostname: text,
      token: text,
      expiresAt: { type: 'string', format: 'date-time' },
      resolvers: {
        type: 'array',
        items: object({ ip: text, asn: nullableNum, country: nullableText, organization: nullableText }),
      },
      complete: bool,
      message: text,
      source: text,
    },
    ['supported', 'source'],
  ),
  Health: object(
    {
      status: text,
      platform: text,
      capabilities: object({
        geo: bool,
        tcpSocket: bool,
        httpProbe: bool,
        kv: bool,
        icmp: bool,
        traceroute: bool,
        dnsCollector: bool,
      }),
      providers: object({ geo: bool, risk: bool, purity: bool, remoteProbe: bool }),
      purity: object({
        model: text,
        publicFeeds: bool,
        localNetworkSnapshots: bool,
        enrichment: object({ ipquery: bool, ipapi: bool, proxycheck: bool, ipqs: bool, abuseipdb: bool }),
      }),
      rateLimit: text,
    },
    ['status', 'platform', 'capabilities', 'providers', 'rateLimit'],
  ),
  Echo: object({ timestamp: num, edge: text, colo: nullableText, region: nullableText }, [
    'timestamp',
    'edge',
    'colo',
    'region',
  ]),
  GlobalResult: {
    type: 'array',
    items: object({ id: text, location: text, latitude: num, longitude: num, result: ref('PingResult') }, [
      'id',
      'location',
      'result',
    ]),
  },
};
export function payloadName(path: string, method: string) {
  if (path.startsWith('/api/ip')) return 'IPInfo';
  if (path.startsWith('/api/asn')) return 'ASNInfo';
  if (path.startsWith('/api/risk')) return 'RiskResult';
  if (path.startsWith('/api/purity')) return 'PurityResult';
  if (path.startsWith('/api/dns-leak')) return 'DnsSession';
  if (path === '/api/dns' || path === '/api/reverse') return 'DNSResult';
  if (path === '/api/health') return 'Health';
  if (path === '/api/global') return 'GlobalResult';
  if (path === '/api/trace') return 'TraceResult';
  return path === '/api/ping' && method === 'get' ? 'Echo' : 'PingResult';
}

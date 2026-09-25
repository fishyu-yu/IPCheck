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
      providers: object({ geo: bool, risk: bool, remoteProbe: bool }),
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
  if (path.startsWith('/api/dns-leak')) return 'DnsSession';
  if (path === '/api/dns' || path === '/api/reverse') return 'DNSResult';
  if (path === '/api/health') return 'Health';
  if (path === '/api/global') return 'GlobalResult';
  if (path === '/api/trace') return 'TraceResult';
  return path === '/api/ping' && method === 'get' ? 'Echo' : 'PingResult';
}

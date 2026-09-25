import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, PlatformAdapter } from '../edge/core/contracts';
import {
  ApiError,
  asnSchema,
  ipSchema,
  publicIp,
  securityHeaders,
  validateHost,
  validatePort,
} from '../edge/core/security';
import { cached } from '../edge/core/cache';
import { acquireProbe, rateLimit } from '../edge/core/ratelimit';
import { currentIp, lookupIp } from './ip/service';
import { riskLookup } from './risk/providers';
import { RipeASNProvider } from './lookup/providers';
import { dnsLookup, recordSchema, reverseName } from './dns/service';
import {
  LocalEdgeProbeProvider,
  RemoteProbeProvider,
  probeLocations,
  probeProvider,
  unsupported,
} from './ping/service';
import { RemoteDnsProbeProvider } from './dns/collector';
import { openApi } from './openapi';
export function createApp(adapter: PlatformAdapter) {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', async (c, next) => {
    Object.entries(securityHeaders).forEach(([k, v]) => c.header(k, v));
    c.header('Cache-Control', 'no-store');
    const origin = c.req.header('origin');
    if (origin && origin !== new URL(c.req.url).origin && origin !== c.env.SITE_URL)
      return c.json(
        {
          success: false,
          error: { code: 'ORIGIN_DENIED', message: 'Cross-origin requests are not allowed' },
        },
        403,
      );
    await next();
    Object.entries(securityHeaders).forEach(([k, v]) => c.header(k, v));
    c.header('Cache-Control', 'no-store');
  });
  app.use('/api/*', async (c, next) => {
    const kind = c.req.method === 'POST' && c.req.path !== '/api/dns-leak/results' ? 'probe' : 'query';
    const allowed = await rateLimit(
      adapter.clientIp(c.req.raw) || 'unidentified',
      kind,
      kind === 'probe' ? c.env.RATE_PROBE : c.env.RATE_QUERY,
    );
    if (!allowed) {
      c.header('Retry-After', '60');
      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `${kind === 'probe' ? 10 : 60} requests per minute exceeded; retry after 60 seconds`,
          },
        },
        429,
      );
    }
    if (kind === 'probe' && c.env.ACTIVE_PROBES === 'off')
      throw new ApiError('PROBES_DISABLED', 'Active probes are disabled by this deployment', 403);
    if (kind === 'probe') {
      const release = await acquireProbe(adapter.clientIp(c.req.raw) || 'unidentified');
      if (!release)
        throw new ApiError('PROBE_BUSY', 'Only one active probe request per client is allowed', 429);
      try {
        await next();
      } finally {
        release();
      }
    } else await next();
  });
  const reply = (data: unknown, edge: string, sources: string[] = []) => ({
    success: true as const,
    data,
    meta: { timestamp: new Date().toISOString(), edge, source: sources },
  });
  app.get('/openapi.json', (c) => c.json(openApi()));
  app.get('/api/health', (c) => {
    const remote = !!(c.env.PROBE_URL && c.env.PROBE_SECRET);
    return c.json(
      reply(
        {
          status: 'operational',
          platform: adapter.name,
          capabilities: {
            ...adapter.capabilities,
            httpProbe: c.env.ACTIVE_PROBES !== 'off' && adapter.capabilities.httpProbe,
            tcpSocket: c.env.ACTIVE_PROBES !== 'off' && adapter.capabilities.tcpSocket,
            icmp: remote && c.env.ACTIVE_PROBES !== 'off',
            traceroute: remote && c.env.ACTIVE_PROBES !== 'off',
            dnsCollector: !!(c.env.DNS_COLLECTOR_URL && c.env.DNS_COLLECTOR_SECRET && c.env.DNS_TEST_DOMAIN),
          },
          providers: {
            geo: c.env.GEO_FREE_PROVIDER !== 'off' || !!c.env.IPINFO_TOKEN,
            risk: !!(c.env.IPQS_KEY || c.env.ABUSEIPDB_KEY),
            remoteProbe: remote,
          },
          rateLimit:
            c.env.RATE_QUERY && c.env.RATE_PROBE
              ? 'Platform bindings'
              : 'Per-isolate fallback; production WAF rate rules required',
        },
        adapter.name,
      ),
    );
  });
  app.get('/api/ip', async (c) => {
    const data = await currentIp(c.req.raw, c.env, adapter);
    return c.json(reply(data, adapter.name, data.sources));
  });
  app.get('/api/ip/:ip', async (c) => {
    const ip = ipSchema.parse(c.req.param('ip'));
    const d = await cached(
      'geo:' + ip,
      86400,
      () => lookupIp(ip, c.env),
      (x) => x.sources.length > 0,
    );
    return c.json(reply(d, adapter.name, d.sources));
  });
  app.get('/api/asn/:asn', async (c) => {
    const asn = asnSchema.parse(c.req.param('asn'));
    const d = await cached(
      'asn:' + asn,
      86400,
      () => new RipeASNProvider().lookup(asn),
      (x) => !!x.organization && x.prefixCount !== null,
    );
    return c.json(reply(d, adapter.name, [d.source]));
  });
  app.get('/api/risk/:ip', async (c) => {
    const ip = ipSchema.parse(c.req.param('ip'));
    if (!publicIp(ip)) throw new ApiError('BLOCKED_TARGET', 'Risk lookup requires a public address');
    const d = await cached(
      'risk:' + ip,
      3600,
      () => riskLookup(ip, c.env),
      (x) => x.checked > 0 && x.warnings.length === 0,
    );
    return c.json(reply(d, adapter.name, d.sources));
  });
  app.get('/api/ping', (c) =>
    c.json(
      reply(
        {
          timestamp: Date.now(),
          edge: adapter.name,
          colo: adapter.context(c.req.raw).colo ?? null,
          region: adapter.context(c.req.raw).region ?? null,
        },
        adapter.name,
        [adapter.name],
      ),
    ),
  );
  async function body(request: Request) {
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new ApiError('INVALID_BODY', 'Content-Type must be application/json');
    const reader = request.body?.getReader();
    let text = '',
      size = 0;
    const decoder = new TextDecoder();
    if (!reader) throw new ApiError('INVALID_BODY', 'JSON body required');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2048) {
        await reader.cancel();
        throw new ApiError('BODY_TOO_LARGE', 'Maximum body size is 2 KB', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    try {
      return JSON.parse(text + decoder.decode()) as unknown;
    } catch {
      throw new ApiError('INVALID_JSON', 'Invalid JSON');
    }
  }
  const probeBody = z.object({
    host: z.string(),
    mode: z.enum(['http', 'icmp']).default('http'),
    protocol: z.enum(['http', 'https']).default('http'),
    port: z.number().default(443),
    node: z.enum(['sin', 'hkg', 'nrt', 'lax', 'fra', 'lhr']).optional(),
  });
  for (const path of ['/api/ping', '/api/http-ping', '/api/tcping', '/api/trace', '/api/global'])
    app.post(path, async (c) => {
      const input = probeBody.parse(await body(c.req.raw));
      const host = validateHost(input.host);
      const provider = probeProvider(c.env, adapter);
      let data: unknown;
      if (path === '/api/tcping')
        data = await provider.tcpPing(host, validatePort(input.port, c.env.ALLOWED_PORTS));
      else if (path === '/api/trace') data = await provider.traceroute(host, input.node);
      else if (path === '/api/global')
        data = await Promise.all(
          probeLocations.map(async (node) => {
            try {
              return {
                ...node,
                result:
                  provider instanceof RemoteProbeProvider
                    ? await provider.ping(host, 'icmp', node.id)
                    : unsupported(host, 'icmp', 'Node unavailable'),
              };
            } catch {
              return {
                ...node,
                result: unsupported(host, 'icmp', 'Node unavailable or timed out', provider.name),
              };
            }
          }),
        );
      else if (path === '/api/http-ping' || input.mode === 'http')
        data =
          provider instanceof LocalEdgeProbeProvider
            ? await provider.httpPing(host, input.protocol)
            : await (provider as RemoteProbeProvider).ping(host, 'http', input.node, input.protocol);
      else data = await provider.ping(host, 'icmp', input.node);
      return c.json(reply(data, adapter.name, [provider.name]));
    });
  app.get('/api/dns', async (c) => {
    const name = validateHost(c.req.query('name'));
    const type = recordSchema.parse(c.req.query('type') || 'A');
    const d = await dnsLookup(name, type, c.env);
    return c.json(reply(d, adapter.name, [d.source]));
  });
  app.get('/api/reverse', async (c) => {
    const ip = ipSchema.parse(c.req.query('ip'));
    const d = await dnsLookup(reverseName(ip), 'PTR', c.env);
    return c.json(reply(d, adapter.name, [d.source]));
  });
  for (const path of ['/api/dns-leak', '/api/dns-leak/results'])
    app.post(path, async (c) => {
      if (!(c.env.DNS_COLLECTOR_URL && c.env.DNS_COLLECTOR_SECRET && c.env.DNS_TEST_DOMAIN))
        return c.json(
          reply(
            {
              supported: false,
              message: 'DNS Leak advanced test requires DNS collector configuration.',
              source: 'Unavailable',
            },
            adapter.name,
          ),
        );
      const p = new RemoteDnsProbeProvider(c.env);
      if (path.endsWith('/results')) {
        const input = z
          .object({ id: z.string().uuid(), token: z.string().min(16).max(512) })
          .parse(await body(c.req.raw));
        return c.json(reply(await p.results(input.id, input.token), adapter.name, [p.name]));
      }
      return c.json(reply(await p.create(), adapter.name, [p.name]));
    });
  app.notFound((c) =>
    c.json({ success: false, error: { code: 'NOT_FOUND', message: 'API route not found' } }, 404),
  );
  app.onError((err, c) => {
    if (err instanceof z.ZodError)
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: err.issues.map((i) => i.message).join('; ') },
        },
        400,
      );
    if (err instanceof ApiError)
      return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status as 400);
    return c.json(
      {
        success: false,
        error: {
          code: 'UPSTREAM_UNAVAILABLE',
          message: 'The operation failed or timed out. No detection result is available.',
        },
      },
      502,
    );
  });
  return app;
}

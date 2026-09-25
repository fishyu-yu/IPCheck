import { z } from 'zod';
import type { Env, PlatformAdapter, ProbeProvider } from '../../edge/core/contracts';
import type { PingResult, ProbeNode, TraceResult } from '../../src/types';
import {
  ApiError,
  fetchJson,
  ipSchema,
  trustedUrl,
  validateHost,
  validatePort,
} from '../../edge/core/security';
import { resolvePublic } from '../dns/service';
export const probeLocations: Omit<ProbeNode, 'available'>[] = [
  { id: 'sin', location: 'Singapore', latitude: 1.35, longitude: 103.82 },
  { id: 'hkg', location: 'Hong Kong', latitude: 22.32, longitude: 114.17 },
  { id: 'nrt', location: 'Tokyo', latitude: 35.68, longitude: 139.69 },
  { id: 'lax', location: 'Los Angeles', latitude: 34.05, longitude: -118.24 },
  { id: 'fra', location: 'Frankfurt', latitude: 50.11, longitude: 8.68 },
  { id: 'lhr', location: 'London', latitude: 51.51, longitude: -0.13 },
];
export const unsupported = (
  host: string,
  mode: PingResult['mode'],
  message: string,
  source = 'edge',
): PingResult => ({ supported: false, host, mode, message, source, detection: 'Estimated / Unsupported' });
export class LocalEdgeProbeProvider implements ProbeProvider {
  name = 'Local edge';
  constructor(
    private adapter: PlatformAdapter,
    private env: Env,
  ) {}
  async ping(host: string, mode: 'http' | 'icmp'): Promise<PingResult> {
    validateHost(host);
    if (mode === 'icmp')
      return unsupported(host, mode, 'ICMP requires an authenticated Probe Agent', this.adapter.name);
    return this.httpPing(host, 'http');
  }
  async httpPing(host: string, protocol: 'http' | 'https'): Promise<PingResult> {
    const ips = await resolvePublic(host, this.env);
    if (!this.adapter.http)
      return unsupported(host, 'http', 'HTTP probing unavailable on this runtime', this.adapter.name);
    if (protocol === 'https' && !ipSchema.safeParse(host).success)
      return unsupported(
        host,
        'http',
        'This runtime cannot safely pin HTTPS DNS and preserve certificate hostname verification. Configure a remote Probe Agent, or explicitly select HTTP.',
        this.adapter.name,
      );
    const result = await this.adapter.http(ips[0], host, protocol);
    return {
      supported: true,
      success: true,
      host,
      mode: 'http',
      targetIp: ips[0],
      ...result,
      source: this.adapter.name,
      detection: 'Real Detection',
      measured: ['HEAD request elapsed time; no redirect followed', 'DNS/connect/TTFB breakdown unavailable'],
    };
  }
  async tcpPing(host: string, port: number): Promise<PingResult> {
    validateHost(host);
    validatePort(port, this.env.ALLOWED_PORTS);
    if (!this.adapter.tcp)
      return unsupported(host, 'tcp', 'TCP Ping unavailable on this edge provider', this.adapter.name);
    const ips = await resolvePublic(host, this.env);
    const latency = await this.adapter.tcp(ips[0], port);
    return {
      supported: true,
      success: true,
      mode: 'tcp',
      host,
      port,
      latency,
      targetIp: ips[0],
      source: this.adapter.name,
      detection: 'Real Detection',
    };
  }
  async traceroute(host: string): Promise<TraceResult> {
    validateHost(host);
    return {
      supported: false,
      hops: [],
      source: this.name,
      message: 'Traceroute requires an authenticated Probe Agent',
    };
  }
}
const pingSchema = z.object({
  success: z.boolean(),
  latency: z.number().min(0).max(60000).optional(),
  totalTime: z.number().min(0).max(60000).optional(),
  status: z.number().int().min(100).max(599).optional(),
  server: z.string().max(256).optional(),
  targetIp: ipSchema.optional(),
  message: z.string().max(500).optional(),
});
const traceSchema = z.object({
  hops: z
    .array(
      z.object({
        hop: z.number().int().min(1).max(30),
        ip: ipSchema.nullable(),
        hostname: z.string().max(253).nullable(),
        asn: z.number().int().nullable(),
        country: z.string().max(100).nullable(),
        latency: z.number().min(0).nullable(),
      }),
    )
    .max(30),
});
export class RemoteProbeProvider implements ProbeProvider {
  name = 'Remote Probe Agent';
  constructor(private env: Env) {}
  private async send(path: string, host: string, extra: Record<string, unknown> = {}) {
    const targetIps = await resolvePublic(host, this.env);
    if (!this.env.PROBE_URL || !this.env.PROBE_SECRET)
      throw new ApiError('PROBE_UNAVAILABLE', 'Probe Agent is not configured', 503);
    const base = trustedUrl(this.env.PROBE_URL);
    return fetchJson(new URL(base.pathname.replace(/\/$/, '') + path, base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.env.PROBE_SECRET}` },
      body: JSON.stringify({
        version: 1,
        requestId: crypto.randomUUID(),
        host,
        targetIps,
        timeoutMs: 3000,
        ...extra,
      }),
    });
  }
  async ping(
    host: string,
    mode: 'http' | 'icmp',
    node?: string,
    protocol: 'http' | 'https' = 'http',
  ): Promise<PingResult> {
    const d = pingSchema.parse(await this.send('/probe/ping', host, { mode, node, protocol, count: 1 }));
    return {
      ...d,
      supported: true,
      host,
      mode,
      source: this.name + (node ? ' / ' + node : ''),
      detection: 'Provider Detection',
    };
  }
  async tcpPing(host: string, port: number): Promise<PingResult> {
    validatePort(port, this.env.ALLOWED_PORTS);
    const d = pingSchema.parse(await this.send('/probe/tcp', host, { port }));
    return {
      ...d,
      supported: true,
      host,
      port,
      mode: 'tcp',
      source: this.name,
      detection: 'Provider Detection',
    };
  }
  async traceroute(host: string, node?: string): Promise<TraceResult> {
    const d = traceSchema.parse(await this.send('/probe/traceroute', host, { node, maxHops: 20 }));
    return { ...d, supported: true, source: this.name };
  }
}
export function probeProvider(env: Env, adapter: PlatformAdapter): ProbeProvider {
  return env.PROBE_URL && env.PROBE_SECRET
    ? new RemoteProbeProvider(env)
    : new LocalEdgeProbeProvider(adapter, env);
}
export async function pinnedHttp(ip: string, host: string, protocol: 'http' | 'https') {
  // Connect to the validated IP literal, not to the untrusted hostname. Never follow redirects.
  const start = performance.now();
  const address = ip.includes(':') ? `[${ip}]` : ip;
  const response = await fetch(`${protocol}://${address}/`, {
    method: 'HEAD',
    headers: { Host: host, Accept: '*/*' },
    redirect: 'manual',
    signal: AbortSignal.timeout(4000),
    cache: 'no-store',
  });
  await response.body?.cancel();
  return {
    status: response.status,
    server: response.headers.get('server') || undefined,
    totalTime: performance.now() - start,
  };
}

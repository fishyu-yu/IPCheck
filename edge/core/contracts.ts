import type {
  ASNInfo,
  DnsSession,
  EdgeContext,
  IPInfo,
  PingResult,
  PlatformCapabilities,
  RiskSignal,
  TraceResult,
} from '../../src/types';
export interface RateBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
export interface Env {
  IPINFO_TOKEN?: string;
  IPQS_KEY?: string;
  ABUSEIPDB_KEY?: string;
  GEO_FREE_PROVIDER?: string;
  DOH_URLS?: string;
  PROBE_URL?: string;
  PROBE_SECRET?: string;
  DNS_COLLECTOR_URL?: string;
  DNS_COLLECTOR_SECRET?: string;
  DNS_TEST_DOMAIN?: string;
  ALLOWED_PORTS?: string;
  SITE_URL?: string;
  DEV_PUBLIC_IP?: string;
  ACTIVE_PROBES?: string;
  RATE_QUERY?: RateBinding;
  RATE_PROBE?: RateBinding;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}
export interface PlatformAdapter {
  name: string;
  context(request: Request): EdgeContext;
  clientIp(request: Request): string | null;
  capabilities: PlatformCapabilities;
  tcp?(ip: string, port: number): Promise<number>;
  http?(
    ip: string,
    host: string,
    protocol: 'http' | 'https',
  ): Promise<Pick<PingResult, 'status' | 'server' | 'totalTime'>>;
}
export interface GeoProvider {
  name: string;
  lookup(ip: string): Promise<Partial<IPInfo>>;
}
export interface RiskProvider {
  name: string;
  lookup(ip: string): Promise<RiskSignal[]>;
}
export interface ASNProvider {
  name: string;
  lookup(asn: number): Promise<ASNInfo>;
}
export interface ProbeProvider {
  name: string;
  ping(host: string, mode: 'http' | 'icmp', node?: string): Promise<PingResult>;
  tcpPing(host: string, port: number): Promise<PingResult>;
  traceroute(host: string, node?: string): Promise<TraceResult>;
}
export interface DnsProbeProvider {
  name: string;
  create(): Promise<DnsSession>;
  results(id: string, token: string): Promise<DnsSession>;
}

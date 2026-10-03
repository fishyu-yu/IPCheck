import type { riskWeights } from '../config/risk.config';
export type Detection =
  'Real Detection' | 'Provider Detection' | 'Browser-side Detection' | 'Estimated / Unsupported';
export type IPType =
  'Residential' | 'Datacenter' | 'Mobile' | 'Business' | 'Education' | 'Government' | 'Unknown';
export interface Evidence<T> {
  value: T | null;
  source: string;
  confidence: number | null;
  detection: Detection;
}
export interface EdgeContext {
  provider: string;
  colo?: string;
  city?: string;
  region?: string;
  country?: string;
  asn?: number;
  timezone?: string;
  organization?: string;
  latitude?: number;
  longitude?: number;
}
export interface PlatformCapabilities {
  geo: boolean;
  tcpSocket: boolean;
  httpProbe: boolean;
  kv: boolean;
  icmp: boolean;
  traceroute: boolean;
  dnsCollector: boolean;
}
export interface IPInfo {
  ip: string | null;
  version: 4 | 6 | null;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  postal?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  asn?: number;
  asnName?: string;
  organization?: string;
  isp?: string;
  prefix?: string;
  reverseDns?: string;
  hostingProvider?: string;
  asnType?: PurityTypeEvidence;
  companyType?: PurityTypeEvidence;
  type: Evidence<IPType>[];
  sources: string[];
  fieldSources?: Record<string, string>;
  partial: boolean;
  warnings: string[];
  edge?: EdgeContext;
  userAgent?: string;
  detection: Detection;
}
export type RiskKey = keyof typeof riskWeights;
export interface RiskSignal extends Evidence<boolean | number> {
  key: RiskKey;
}
export interface RiskResult {
  ip: string;
  score: number | null;
  level: 'Low Risk' | 'Moderate Risk' | 'High Risk' | 'Not checked';
  signals: RiskSignal[];
  checked: number;
  total: number;
  conflicts: RiskKey[];
  partial: boolean;
  model: string;
  sources: string[];
  warnings: string[];
}
export type NetworkCategory = 'isp' | 'hosting' | 'business' | 'education' | 'government' | 'unknown';
export interface PurityTypeEvidence {
  type: NetworkCategory;
  source: string;
  inferred: boolean;
}
export interface PurityFeedEvidence {
  source: string;
  url: string;
  checked: boolean;
  updatedAt: string | null;
  copyright?: string;
}
export interface PurityNeighborhood {
  cidr: string | null;
  activityCidr?: string | null;
  activitySource?: string | null;
  activityKind?: 'recent-c2' | 'threat-list';
  activeBadNeighbors: number | null;
  abuseDensity: number | null;
  scope: 'ipv4-/24' | 'company-network' | 'none';
  source: string;
}
export interface PurityInput {
  asnType?: PurityTypeEvidence;
  companyType?: PurityTypeEvidence;
  signals: RiskSignal[];
  neighborhood?: PurityNeighborhood;
  feeds: PurityFeedEvidence[];
  warnings: string[];
}
export type PurityDimensionKey = 'asn' | 'company' | 'anonymity' | 'abuse' | 'neighborhood';
export interface PurityDimension {
  key: PurityDimensionKey;
  score: number;
  weight: number;
  observed: boolean;
  inferred: boolean;
  evidence: string;
  sources: string[];
}
export interface PurityResult {
  ip: string;
  score: number;
  level: 'High purity' | 'Moderate purity' | 'Low purity' | 'Insufficient evidence';
  confidence: 'High' | 'Medium' | 'Low';
  coverage: number;
  status: 'assessed' | 'limited' | 'insufficient';
  model: string;
  assessedAt: string;
  dimensions: PurityDimension[];
  asnType: PurityTypeEvidence;
  companyType: PurityTypeEvidence;
  neighborhood: PurityNeighborhood;
  feeds: PurityFeedEvidence[];
  signals: RiskSignal[];
  conflicts: RiskKey[];
  sources: string[];
  warnings: string[];
}
export interface PingResult {
  supported: boolean;
  success?: boolean;
  mode: 'http' | 'tcp' | 'icmp';
  host: string;
  port?: number;
  latency?: number;
  totalTime?: number;
  status?: number;
  server?: string;
  targetIp?: string;
  message?: string;
  source: string;
  detection: Detection;
  measured?: string[];
}
export type TcpPingResult = PingResult;
export interface ProbeNode {
  id: string;
  location: string;
  latitude: number;
  longitude: number;
  available: boolean;
}
export interface TraceHop {
  hop: number;
  ip: string | null;
  hostname: string | null;
  asn: number | null;
  country: string | null;
  latency: number | null;
}
export interface TraceResult {
  supported: boolean;
  hops: TraceHop[];
  source: string;
  message?: string;
}
export interface DNSAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}
export interface DNSResult {
  name: string;
  type: string;
  status: number;
  answers: DNSAnswer[];
  source: string;
  detection: Detection;
}
export interface ASNInfo {
  asn: number;
  organization: string | null;
  country: string | null;
  rir: string | null;
  prefixCount: number | null;
  ipv4: string[];
  ipv6: string[];
  upstreams: string[] | null;
  source: string;
  partial: boolean;
  warnings: string[];
}
export interface BrowserEnvironment {
  sections: Record<string, Record<string, string | number | boolean>>;
  detection: Detection;
}
export interface DnsResolver {
  ip: string;
  asn: number | null;
  country: string | null;
  organization: string | null;
}
export interface DnsSession {
  supported: boolean;
  id?: string;
  hostname?: string;
  token?: string;
  expiresAt?: string;
  resolvers?: DnsResolver[];
  complete?: boolean;
  message?: string;
  source: string;
}
export type ApiResponse<T> =
  | { success: true; data: T; meta: { timestamp: string; edge: string; source: string[] } }
  | { success: false; error: { code: string; message: string } };

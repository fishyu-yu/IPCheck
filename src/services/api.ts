import type { ApiResponse, IPInfo, PlatformCapabilities, RiskResult } from '../types';
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  const result = (await response.json()) as ApiResponse<T>;
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
export interface Health {
  status: string;
  platform: string;
  capabilities: PlatformCapabilities;
  providers: { geo: boolean; risk: boolean; remoteProbe: boolean };
  rateLimit: string;
}
export const getCurrentIp = () => api<IPInfo>('/api/ip');
export const getHealth = () => api<Health>('/api/health');
export const getRisk = (ip: string) => api<RiskResult>('/api/risk/' + encodeURIComponent(ip));

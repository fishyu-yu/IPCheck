import { useQuery } from '@tanstack/react-query';
import { getCurrentIp, getHealth, getRisk } from '../services/api';
export const useCurrentIp = () =>
  useQuery({ queryKey: ['current-ip'], queryFn: getCurrentIp, staleTime: 300000, retry: 0 });
export const useHealth = () =>
  useQuery({ queryKey: ['health'], queryFn: getHealth, staleTime: 60000, retry: 0 });
export const useRisk = (ip?: string | null) =>
  useQuery({
    queryKey: ['risk', ip],
    queryFn: () => getRisk(ip!),
    enabled: !!ip,
    staleTime: 3600000,
    retry: 0,
  });

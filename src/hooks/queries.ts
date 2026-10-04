import { useQuery } from '@tanstack/react-query';
import { getCurrentIp, getHealth, getPurity, getRisk } from '../services/api';
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
export const usePurity = (ip?: string | null) =>
  useQuery({
    queryKey: ['purity', ip],
    queryFn: ({ signal }) => getPurity(ip!, signal),
    enabled: !!ip,
    staleTime: (query) => {
      const data = query.state.data;
      return !data || data.status !== 'assessed' || data.feeds.some((feed) => !feed.checked) ? 60000 : 900000;
    },
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      const data = query.state.data;
      return !data || data.status !== 'assessed' || data.feeds.some((feed) => !feed.checked) ? 60000 : 900000;
    },
    // Retain only this query key's assessment while refreshing; another IP starts empty.
    placeholderData: undefined,
    retry: 0,
  });

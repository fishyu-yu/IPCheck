import { navigation } from '../config/site';
import type { Health } from '../services/api';
import { useHealth } from './queries';

// Keep every route and implementation; only advertise capabilities the runtime confirms.
export function isToolAvailable(key: string, health?: Health): boolean {
  // The purity model is built in and always accepts public IP lookups.
  if (key === 'ping') return health?.capabilities.httpProbe === true || health?.capabilities.icmp === true;
  if (key === 'tcp') return health?.capabilities.tcpSocket === true || health?.capabilities.icmp === true;
  return true;
}

export function useVisibleNavigation() {
  const health = useHealth();
  return navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isToolAvailable(item[2], health.data)),
    }))
    .filter((section) => section.items.length);
}

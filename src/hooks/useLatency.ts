import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
export function useLatency() {
  const [samples, setSamples] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async () => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setSamples([]);
    setBusy(true);
    setError('');
    try {
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await api('/api/ping?t=' + crypto.randomUUID(), undefined, ctrl.signal);
        setSamples((s) => [...s, performance.now() - start]);
        if (i < 9) await new Promise((r) => setTimeout(r, 200));
        if (ctrl.signal.aborted) break;
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Latency test failed');
    } finally {
      setBusy(false);
    }
  };
  return { samples, busy, error, run, stop: () => controller.current?.abort() };
}

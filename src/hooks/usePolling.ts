import { useCallback, useEffect, useRef, useState } from 'react';

/** Runs `load` immediately and then every `intervalMs` while enabled. */
export function usePolling(load: () => Promise<void>, intervalMs: number, enabled = true) {
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async () => {
    try {
      await loadRef.current();
      setError(null);
      setLastLoadedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run();
    const id = window.setInterval(() => void run(), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, run]);

  return { error, lastLoadedAt, reload: run };
}

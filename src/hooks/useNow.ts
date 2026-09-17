import { useEffect, useState } from 'react';

/** Current time, re-rendered every `everyMs`. Drives countdowns. */
export function useNow(everyMs = 250, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs, enabled]);
  return now;
}

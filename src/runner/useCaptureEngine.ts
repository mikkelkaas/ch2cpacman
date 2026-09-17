import { useCallback, useEffect, useRef, useState } from 'react';
import type { Fix } from '../hooks/useGeolocation';
import { api } from '../lib/api';
import { pelletsWithin } from '../lib/capture';
import { drain, enqueue, pending } from '../lib/queue';
import { sound } from '../lib/sound';
import type { Pellet, Team } from '../lib/types';

const RETRY_MS = 5000;

interface Options {
  active: boolean;
  fix: Fix | null;
  pellets: readonly Pellet[];
  team: Team;
  initialEatenIds: ReadonlySet<string>;
}

/**
 * Eats every uneaten pellet within reach of each new fix, queues the capture
 * locally first and uploads in the background. The phone's own score counts
 * queued captures, so a dead spot never costs points.
 */
export function useCaptureEngine({ active, fix, pellets, team, initialEatenIds }: Options) {
  const [eatenIds, setEatenIds] = useState<ReadonlySet<string>>(initialEatenIds);
  const [pendingCount, setPendingCount] = useState(() => pending().length);
  const [lastEaten, setLastEaten] = useState<Pellet | null>(null);
  const eatenRef = useRef(eatenIds);
  eatenRef.current = eatenIds;
  const draining = useRef(false);

  const upload = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    try {
      const { left } = await drain(c => api.captures.create(c));
      setPendingCount(left);
    } finally {
      draining.current = false;
    }
  }, []);

  useEffect(() => {
    if (!active || !fix) return;
    const hits = pelletsWithin(fix, pellets, eatenRef.current);
    if (hits.length === 0) return;
    const next = new Set(eatenRef.current);
    for (const pellet of hits) {
      next.add(pellet._id);
      enqueue({
        teamId: team._id,
        pelletId: pellet._id,
        capturedAt: new Date().toISOString(),
        lat: fix.lat,
        lng: fix.lng,
        clientId: crypto.randomUUID(),
      });
    }
    eatenRef.current = next;
    setEatenIds(next);
    setLastEaten(hits[hits.length - 1]);
    setPendingCount(pending().length);
    sound.chomp();
    void upload();
  }, [active, fix, pellets, team._id, upload]);

  // Retry while anything is waiting, whether or not the phase is still running.
  useEffect(() => {
    if (pendingCount === 0) return;
    const id = window.setInterval(() => void upload(), RETRY_MS);
    return () => window.clearInterval(id);
  }, [pendingCount, upload]);

  const points = pellets.filter(p => eatenIds.has(p._id)).reduce((sum, p) => sum + p.points, 0);

  return { eatenIds, points, pendingCount, lastEaten };
}

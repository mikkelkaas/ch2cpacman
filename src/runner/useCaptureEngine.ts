import { useCallback, useEffect, useRef, useState } from 'react';
import type { Fix } from '../hooks/useGeolocation';
import { api } from '../lib/api';
import { pelletsWithin } from '../lib/capture';
import { drain, enqueue, pending } from '../lib/queue';
import { sound } from '../lib/sound';
import { dedupeCaptures, scoreTeam } from '../lib/score';
import type { Capture, GameSettings, Pellet, Team } from '../lib/types';

const RETRY_MS = 5000;

interface Options {
  active: boolean;
  fix: Fix | null;
  pellets: readonly Pellet[];
  team: Team;
  settings: GameSettings;
  initialEatenIds: ReadonlySet<string>;
  /** This team's captures already on the server, so a reload keeps their times. */
  initialCaptures: readonly Capture[];
  /** Called with each pellet the moment it is eaten, for power and Dobbelt effects. */
  onEaten?: (pellet: Pellet, atMs: number) => void;
}

/**
 * Eats every uneaten pellet within reach of each new fix, queues the capture
 * locally first and uploads in the background. The phone's own score counts
 * queued captures, so a dead spot never costs points.
 */
export function useCaptureEngine({ active, fix, pellets, team, settings, initialEatenIds, initialCaptures, onEaten }: Options) {
  const [eatenIds, setEatenIds] = useState<ReadonlySet<string>>(initialEatenIds);
  const [pendingCount, setPendingCount] = useState(() => pending().length);
  const [lastEaten, setLastEaten] = useState<Pellet | null>(null);
  const eatenRef = useRef(eatenIds);
  eatenRef.current = eatenIds;
  const draining = useRef(false);
  const onEatenRef = useRef(onEaten);
  onEatenRef.current = onEaten;
  // Capture times, so the Dobbelt multiplier on screen matches the scoreboard.
  const [captureTimes, setCaptureTimes] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const c of dedupeCaptures(initialCaptures)) if (c.teamId === team._id) m.set(c.pelletId, c.capturedAt);
    for (const q of pending()) if (q.teamId === team._id && !m.has(q.pelletId)) m.set(q.pelletId, q.capturedAt);
    return m;
  });

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
    const nowMs = Date.now();
    const capturedAt = new Date(nowMs).toISOString();
    for (const pellet of hits) {
      next.add(pellet._id);
      enqueue({
        teamId: team._id,
        pelletId: pellet._id,
        capturedAt,
        lat: fix.lat,
        lng: fix.lng,
        clientId: crypto.randomUUID(),
      });
      onEatenRef.current?.(pellet, nowMs);
    }
    eatenRef.current = next;
    setEatenIds(next);
    setCaptureTimes(m => {
      const copy = new Map(m);
      for (const pellet of hits) copy.set(pellet._id, capturedAt);
      return copy;
    });
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

  // Score the way the admin does, from timestamps, so Dobbelt windows agree.
  const points = scoreTeam(
    team,
    [...captureTimes.entries()].map(([pelletId, at]) => ({ _id: pelletId, teamId: team._id, pelletId, capturedAt: at, lat: 0, lng: 0, clientId: pelletId })),
    pellets,
    settings,
  ).points;

  return { eatenIds, points, pendingCount, lastEaten, captureTimes, setCaptureTimes };
}

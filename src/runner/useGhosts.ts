import { useEffect, useRef, useState } from 'react';
import type { Fix } from '../hooks/useGeolocation';
import { api } from '../lib/api';
import { isUsableFix } from '../lib/fix';
import { haversineM } from '../lib/geo';
import { frighten, initialGhosts, isFrightened, stepGhosts } from '../lib/ghosts';
import type { GhostState } from '../lib/ghosts';
import { eventQueue } from '../lib/queue';
import { GHOST_WARN_M } from '../lib/settings';
import { sound } from '../lib/sound';
import type { GameEvent, GameEventType, GameSettings, Pellet, Team } from '../lib/types';

const TICK_MS = 250;
const RETRY_MS = 5000;

interface Options {
  active: boolean;
  fix: Fix | null;
  pellets: readonly Pellet[];
  team: Team;
  settings: GameSettings;
  /** Events already on the server for this team, so a reload keeps their points. */
  initialEvents: readonly GameEvent[];
  /** This run's last heartbeat, so a reload continues the chase instead of respawning. */
  restored?: GhostState | null;
}

export interface GhostBanner {
  type: GameEventType;
  points: number;
  at: number;
}

/**
 * Runs the ghost simulation on the phone while the phase is active, records
 * each catch or meal as an event (queued, then uploaded) and keeps a running
 * total of their points for the on-screen score.
 */
export function useGhosts({ active, fix, pellets, team, settings, initialEvents, restored = null }: Options) {
  const [state, setState] = useState<GhostState | null>(null);
  const [eventPoints, setEventPoints] = useState(() => {
    const seen = new Set(initialEvents.map(e => e.clientId));
    const queued = eventQueue.pending().filter(e => e.teamId === team._id && !seen.has(e.clientId));
    return [...initialEvents.filter(e => e.teamId === team._id), ...queued].reduce((sum, e) => sum + e.points, 0);
  });
  const [banner, setBanner] = useState<GhostBanner | null>(null);
  const [nearest, setNearest] = useState<number>(Infinity);
  const stateRef = useRef<GhostState | null>(null);
  const fixRef = useRef(fix);
  fixRef.current = fix;
  const sirenAt = useRef(0);

  // Spawn once the phase is running and a fix exists, or pick up where the
  // last beat left the ghosts if the page was reloaded mid-run.
  useEffect(() => {
    if (!active || !fix || !isUsableFix(fix) || stateRef.current || settings.ghostCount === 0) return;
    const initial = restored ?? initialGhosts(settings, fix, pellets);
    stateRef.current = initial;
    setState(initial);
  }, [active, fix, pellets, settings, restored]);

  useEffect(() => {
    if (!active || !team.startedAt || settings.ghostCount === 0) return;
    const id = window.setInterval(() => {
      const current = stateRef.current;
      const runner = fixRef.current;
      // A poor fix freezes the chase rather than letting a GPS jump decide it.
      if (!current || !runner || !isUsableFix(runner)) return;
      const nowMs = Date.now();
      const { state: next, events } = stepGhosts(current, { settings, runner, pellets, startedAt: team.startedAt!, nowMs, dtS: TICK_MS / 1000 });
      stateRef.current = next;
      setState(next);

      const distance = Math.min(...next.ghosts.map(g => haversineM(runner, g)), Infinity);
      setNearest(distance);
      // A ghost at full rush sirens twice as fast: frantic when it matters.
      const maxRush = Math.max(0, ...next.ghosts.map(g => g.rush ?? 0));
      if (distance < GHOST_WARN_M && !isFrightened(next, nowMs) && nowMs - sirenAt.current > 450 - 225 * maxRush) {
        sirenAt.current = nowMs;
        sound.siren();
      }

      for (const event of events) {
        eventQueue.enqueue({ gameId: team.gameId, teamId: team._id, type: event.type, at: new Date(nowMs).toISOString(), points: event.points, clientId: crypto.randomUUID() });
        setEventPoints(p => p + event.points);
        setBanner({ type: event.type, points: event.points, at: nowMs });
        if (event.type === 'ghost_caught') sound.hurt();
        else sound.ghostEaten();
      }
      if (events.length > 0) void eventQueue.drain(e => api.events.create(e));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [active, pellets, settings, team._id, team.startedAt]);

  // Retry uploads while anything waits.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (eventQueue.pending().length > 0) void eventQueue.drain(e => api.events.create(e));
    }, RETRY_MS);
    return () => window.clearInterval(id);
  }, []);

  // Banners fade after 2 s.
  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), 2000);
    return () => window.clearTimeout(id);
  }, [banner]);

  const powerEaten = () => {
    const current = stateRef.current;
    if (!current) return;
    const next = frighten(current, settings, Date.now());
    stateRef.current = next;
    setState(next);
    sound.power();
  };

  return { ghosts: state, eventPoints, banner, nearest, powerEaten };
}

import { useEffect, useRef } from 'react';
import type { Fix } from '../hooks/useGeolocation';
import { api } from '../lib/api';
import { HEARTBEAT_MS, heartbeatFromGame, shouldSkipBeat } from '../lib/heartbeat';
import type { Heartbeat } from '../lib/heartbeat';
import type { GhostState } from '../lib/ghosts';
import type { Team } from '../lib/types';

interface Options {
  /** Beat while the phase is running or the team is on its way home. */
  active: boolean;
  team: Team;
  fix: Fix | null;
  ghosts: GhostState | null;
}

/**
 * Publishes what only this phone knows, its fix and its ghosts, so a
 * spectator can draw the same map. One document per team, replaced in full
 * every HEARTBEAT_MS when something changed. A beat is also sent unchanged
 * at least every STALE_MS / 2, so a quiet phone (e.g. weak GPS freezing the
 * simulation) is never mistaken for a dead one. A failed write is dropped: a
 * stale beat has no value and the next one replaces it anyway.
 */
export function useHeartbeat({ active, team, fix, ghosts }: Options): void {
  const fixRef = useRef(fix);
  fixRef.current = fix;
  const ghostsRef = useRef(ghosts);
  ghostsRef.current = ghosts;
  const teamRef = useRef(team);
  teamRef.current = team;
  const docId = useRef<string | null>(null);
  const lastSent = useRef<Pick<Heartbeat, 'fix' | 'ghosts'> | null>(null);
  const lastSentAt = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const beat = async () => {
      if (inFlight.current) return;
      const record = heartbeatFromGame(teamRef.current, fixRef.current, ghostsRef.current, Date.now());
      if (shouldSkipBeat(lastSent.current, record, lastSentAt.current, Date.now())) return;
      inFlight.current = true;
      try {
        if (!docId.current) {
          // A reload must not leave the team with two documents: reuse an
          // existing one before creating.
          const existing = await api.heartbeats.list({ teamId: teamRef.current._id });
          docId.current = existing[0]?._id ?? null;
        }
        if (docId.current) {
          await api.heartbeats.update({ ...record, _id: docId.current });
        } else {
          const created = await api.heartbeats.create(record);
          docId.current = created._id;
        }
        if (!cancelled) {
          lastSent.current = { fix: record.fix, ghosts: record.ghosts };
          lastSentAt.current = Date.now();
        }
      } catch {
        // Dropped on purpose. The next tick tries again with a fresh picture.
        // The document may have been deleted by an admin reset, so forget
        // the cached id: the next tick re-looks-up by team id or re-creates.
        docId.current = null;
      } finally {
        inFlight.current = false;
      }
    };

    void beat();
    const id = window.setInterval(() => void beat(), HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active]);
}

import type { Fix } from '../hooks/useGeolocation';
import { isUsableFix } from './fix';
import type { GhostState } from './ghosts';
import type { GameScoped, NewRecord, Team } from './types';

/** How often the runner's phone writes, and how old a beat may be before the spectator marks it stale. */
export const HEARTBEAT_MS = 2000;
export const STALE_MS = 8000;

export interface HeartbeatFix {
  lat: number;
  lng: number;
  accuracyM: number;
  /** Phone clock, ms since epoch, when the fix was taken. */
  at: number;
}

/**
 * What the runner's phone knows and nobody else does: where it is and where
 * its ghosts are. One document per team, replaced on every beat. Not part of
 * the score.
 */
export interface Heartbeat extends GameScoped {
  _id: string;
  teamId: string;
  /** Null when the phone has no usable fix. */
  fix: HeartbeatFix | null;
  /** Null before the ghosts have spawned or when ghosts are off. */
  ghosts: GhostState | null;
  /** When the beat was written, ISO string from the runner phone's clock. */
  at: string;
}

export function heartbeatFromGame(team: Pick<Team, '_id' | 'gameId'>, fix: Fix | null, ghosts: GhostState | null, nowMs: number): NewRecord<Heartbeat> {
  const usable = fix && isUsableFix(fix) ? { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, at: fix.at } : null;
  return { teamId: team._id, gameId: team.gameId, fix: usable, ghosts, at: new Date(nowMs).toISOString() };
}

/** Same picture as the last beat: nothing worth sending. */
export function sameBeat(a: Pick<Heartbeat, 'fix' | 'ghosts'> | null, b: Pick<Heartbeat, 'fix' | 'ghosts'>): boolean {
  if (!a) return false;
  return JSON.stringify({ fix: a.fix, ghosts: a.ghosts }) === JSON.stringify({ fix: b.fix, ghosts: b.ghosts });
}

/** Skip a write only when nothing changed AND the last write is recent enough that the spectator cannot mistake silence for a dead phone. */
export function shouldSkipBeat(prev: Pick<Heartbeat, 'fix' | 'ghosts'> | null, next: Pick<Heartbeat, 'fix' | 'ghosts'>, lastSentAtMs: number, nowMs: number): boolean {
  return sameBeat(prev, next) && nowMs - lastSentAtMs < STALE_MS / 2;
}

export function staleForMs(beat: Pick<Heartbeat, 'at'> | null, nowMs: number): number | null {
  if (!beat) return null;
  return Math.max(0, nowMs - Date.parse(beat.at));
}

export function isStale(beat: Pick<Heartbeat, 'at'> | null, nowMs: number): boolean {
  const age = staleForMs(beat, nowMs);
  return age === null || age >= STALE_MS;
}

/**
 * The ghost state to continue from after the runner's phone reloads: the last
 * beat of this run, if it has ghosts. Spawn times and timers are the phone's
 * own clock, so positions, speed ramp and power/immunity carry straight over.
 * A beat from before this start (an earlier run) is ignored.
 */
export function restoredGhosts(beat: Pick<Heartbeat, 'at' | 'ghosts'> | null, team: Pick<Team, 'startedAt'>): GhostState | null {
  if (!beat || !beat.ghosts || !team.startedAt) return null;
  if (Date.parse(beat.at) < Date.parse(team.startedAt)) return null;
  return beat.ghosts;
}

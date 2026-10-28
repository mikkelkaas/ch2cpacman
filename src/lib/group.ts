import { lateWindowMs } from './late';
import { GRACE_MS, phaseEndMs } from './phase';
import type { GameSettings, Settings, Team } from './types';

/** Both group modes start every team on one signal from the leader. */
export function isGroupMode(s: Pick<Settings, 'playMode'>): boolean {
  return s.playMode === 'together' || s.playMode === 'shared';
}

/** A dot is eaten once for the whole game. */
export function isSharedDots(s: Pick<Settings, 'playMode'>): boolean {
  return s.playMode === 'shared';
}

/**
 * The team as the game sees it: in a group mode the start is the group signal,
 * whatever the stored record says. Never write this copy back to the store.
 */
export function withGroupStart<T extends Pick<Team, 'startedAt'>>(team: T, s: Pick<Settings, 'playMode' | 'groupStartedAt'>): T {
  return isGroupMode(s) ? { ...team, startedAt: s.groupStartedAt ?? null } : team;
}

/** Milliseconds until a signal that lies in the future; 0 in solo, with no signal, or once it has passed. */
export function signalPendingMs(s: Pick<Settings, 'playMode' | 'groupStartedAt'>, nowMs: number): number {
  if (!isGroupMode(s) || !s.groupStartedAt) return 0;
  return Math.max(0, Date.parse(s.groupStartedAt) - nowMs);
}

/** When no score in the group game can change any more: the end, the longest late window and the upload grace. Null before the signal. */
export function groupEndMs(s: GameSettings): number | null {
  if (!s.groupStartedAt) return null;
  return phaseEndMs(s.groupStartedAt, s.phaseMinutes) + lateWindowMs(s) + GRACE_MS;
}

/** The mode is locked once anything has started or been captured. Reads raw team records, not effective ones. */
export function canChangePlayMode(s: Pick<Settings, 'groupStartedAt'>, rawTeams: readonly Team[], captureCount: number): boolean {
  return !s.groupStartedAt && !rawTeams.some((t) => t.startedAt) && captureCount === 0;
}

/**
 * What a fresh read of the settings means for a phone that has the game open.
 * `restart`: the signal it had was cleared (Nulstil alle) or replaced (a new
 * Start alle), so the run it shows is gone. `update`: the signal came, or the
 * Spilform changed. `none`: nothing the phone needs.
 */
export function settingsChange(open: Pick<Settings, 'playMode' | 'groupStartedAt'>, fresh: Pick<Settings, 'playMode' | 'groupStartedAt'>): 'none' | 'update' | 'restart' {
  const had = open.groupStartedAt ?? null;
  const has = fresh.groupStartedAt ?? null;
  if (had && has !== had) return 'restart';
  if (has !== had || (open.playMode ?? 'solo') !== (fresh.playMode ?? 'solo')) return 'update';
  return 'none';
}

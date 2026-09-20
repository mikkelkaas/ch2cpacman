import { lateWindowMs } from './late';
import type { LateRule } from './late';
import type { Team } from './types';

/** A capture whose upload lands this long after the countdown ended still counts. */
export const GRACE_MS = 30_000;

export function phaseEndMs(startedAt: string, phaseMinutes: number): number {
  return Date.parse(startedAt) + phaseMinutes * 60_000;
}

/**
 * `late`: the countdown has ended but the team is not home yet and the late
 * penalty is still growing. Without a rule the run is over at the end.
 */
export type PhaseState = 'idle' | 'running' | 'late' | 'over';

export function phaseState(team: Pick<Team, 'startedAt' | 'returnedAt'>, phaseMinutes: number, nowMs: number, rule?: LateRule): PhaseState {
  if (!team.startedAt) return 'idle';
  const end = phaseEndMs(team.startedAt, phaseMinutes);
  if (nowMs < end) return 'running';
  if (rule && !team.returnedAt && nowMs < end + lateWindowMs(rule)) return 'late';
  return 'over';
}

export function remainingMs(startedAt: string, phaseMinutes: number, nowMs: number): number {
  return Math.max(0, phaseEndMs(startedAt, phaseMinutes) - nowMs);
}

/** Milliseconds past the end, 0 while the run is still going. */
export function lateMs(startedAt: string, phaseMinutes: number, nowMs: number): number {
  return Math.max(0, nowMs - phaseEndMs(startedAt, phaseMinutes));
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

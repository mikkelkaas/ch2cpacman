import type { Team } from './types';

/** A capture whose upload lands this long after the countdown ended still counts. */
export const GRACE_MS = 30_000;

export function phaseEndMs(startedAt: string, phaseMinutes: number): number {
  return Date.parse(startedAt) + phaseMinutes * 60_000;
}

export type PhaseState = 'idle' | 'running' | 'over';

export function phaseState(team: Pick<Team, 'startedAt'>, phaseMinutes: number, nowMs: number): PhaseState {
  if (!team.startedAt) return 'idle';
  return nowMs < phaseEndMs(team.startedAt, phaseMinutes) ? 'running' : 'over';
}

export function remainingMs(startedAt: string, phaseMinutes: number, nowMs: number): number {
  return Math.max(0, phaseEndMs(startedAt, phaseMinutes) - nowMs);
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

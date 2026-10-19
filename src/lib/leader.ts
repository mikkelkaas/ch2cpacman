import { phaseState } from './phase';
import { SETTINGS_DEFAULTS } from './settings';
import type { GameSettings, Team } from './types';

/** The most a team can get in e-vent. */
export const EVENT_MAX = 20;

/** A team's points as the 0–20 the leaders enter in e-vent. */
export function eventScore(points: number, divisor: number): number {
  const by = Number.isFinite(divisor) && divisor > 0 ? divisor : SETTINGS_DEFAULTS.eventDivisor;
  return Math.min(EVENT_MAX, Math.max(0, Math.round(points / by)));
}

/** Where a team is, as the leaders at the post see it. */
export type LeaderStatus = 'notPlayed' | 'running' | 'missingEvent' | 'done';

export const LEADER_STATUSES: readonly LeaderStatus[] = ['notPlayed', 'running', 'missingEvent', 'done'];

/** Running includes the late run home: the score is not final until the team is back. */
export function leaderStatus(team: Team, settings: GameSettings, nowMs: number): LeaderStatus {
  const rule = { lateStepS: settings.lateStepS, latePenaltyPerStep: settings.latePenaltyPerStep, latePenaltyMax: settings.latePenaltyMax };
  const state = phaseState(team, settings.phaseMinutes, nowMs, rule);
  if (state === 'idle') return 'notPlayed';
  if (state !== 'over') return 'running';
  return team.eventSubmitted ? 'done' : 'missingEvent';
}

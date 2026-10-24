import { isUsableFix } from './fix';
import type { Heartbeat } from './heartbeat';
import { isStale, staleForMs } from './heartbeat';
import { phaseState } from './phase';
import { SETTINGS_DEFAULTS } from './settings';
import type { GameSettings, Team } from './types';

/** The most a team can get in e-vent. */
export const EVENT_MAX = 25;

/** A team's points as the 0–25 the leaders enter in e-vent. */
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

/** Where a running team's phone last said it was. */
export interface TeamPosition {
  team: Team;
  lat: number;
  lng: number;
  /** How old the beat is. */
  ageMs: number;
  /** The phone has gone quiet: the dot shows where it was, not where it is. */
  stale: boolean;
}

/**
 * The runner phones' last positions for the given teams, from their
 * heartbeats. A beat from before the team's start (an earlier run) or without
 * a usable fix gives no position.
 */
export function teamPositions(teams: readonly Team[], beats: readonly Pick<Heartbeat, 'teamId' | 'fix' | 'at'>[], nowMs: number): TeamPosition[] {
  const byTeam = new Map(beats.map(b => [b.teamId, b]));
  return teams.flatMap(team => {
    const beat = byTeam.get(team._id);
    if (!beat?.fix || !isUsableFix(beat.fix) || !team.startedAt) return [];
    if (Date.parse(beat.at) < Date.parse(team.startedAt)) return [];
    return [{ team, lat: beat.fix.lat, lng: beat.fix.lng, ageMs: staleForMs(beat, nowMs) ?? 0, stale: isStale(beat, nowMs) }];
  });
}

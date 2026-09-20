import { haversineM } from './geo';
import { phaseEndMs } from './phase';
import type { LatLng } from './types';

/** Every whole block of this length past the end costs `latePenaltyPer10s`. */
export const LATE_STEP_MS = 10_000;

export interface LateRule {
  latePenaltyPer10s: number;
  latePenaltyMax: number;
}

/**
 * How long after the end the penalty keeps growing. Once it has reached the
 * cap there is nothing more to lose, so the phone gives up waiting for home
 * and shows GAME OVER. 0 when the rule is off.
 */
export function lateWindowMs(rule: LateRule): number {
  if (rule.latePenaltyPer10s <= 0 || rule.latePenaltyMax <= 0) return 0;
  return Math.ceil(rule.latePenaltyMax / rule.latePenaltyPer10s) * LATE_STEP_MS;
}

/**
 * Points lost for reaching home at `returnedAt`, or for still being out at
 * `nowMs`. Derived from timestamps only, so the phone and the admin agree.
 */
export function latePenalty(startedAt: string, rule: LateRule & { phaseMinutes: number }, returnedAt: string | null | undefined, nowMs: number): number {
  const window = lateWindowMs(rule);
  if (window === 0) return 0;
  const at = returnedAt ? Date.parse(returnedAt) : nowMs;
  const lateMs = Math.min(window, Math.max(0, at - phaseEndMs(startedAt, rule.phaseMinutes)));
  return Math.min(rule.latePenaltyMax, rule.latePenaltyPer10s * Math.floor(lateMs / LATE_STEP_MS));
}

/** Inside the home radius of the start point, edge inclusive, like a pellet. */
export function isHome(fix: LatLng, start: LatLng, homeRadiusM: number): boolean {
  return haversineM(fix, start) <= homeRadiusM;
}

import { haversineM } from './geo';
import type { LatLng, Pellet } from './types';

/** Two fixes further apart in time than this are not joined by a straight line. */
export const MAX_SEGMENT_GAP_S = 10;
/** Faster than this between two fixes is a GPS jump, not a scout running. */
export const MAX_SEGMENT_SPEED_MPS = 7;

export interface TimedFix extends LatLng {
  /** Epoch milliseconds of the fix. */
  at: number;
}

/** Uneaten pellets whose radius contains the fix. Inclusive: at the edge counts. */
export function pelletsWithin(fix: LatLng, pellets: readonly Pellet[], eatenIds: ReadonlySet<string>): Pellet[] {
  return pellets.filter(p => !eatenIds.has(p._id) && haversineM(fix, p) <= p.radiusM);
}

/**
 * Uneaten pellets the team passed on its way from `prev` to `fix`: the straight
 * line between the two fixes comes within the pellet's radius. With a few
 * seconds between fixes a team can run right through a pellet without a fix
 * landing inside it. The line is only drawn when the two fixes are close in
 * time and the speed between them is one a runner can do; otherwise, or with
 * no `prev`, only `fix` itself counts.
 */
export function pelletsAlong(prev: TimedFix | null, fix: TimedFix, pellets: readonly Pellet[], eatenIds: ReadonlySet<string>): Pellet[] {
  if (!prev || !isPlausibleSegment(prev, fix)) return pelletsWithin(fix, pellets, eatenIds);
  return pellets.filter(p => !eatenIds.has(p._id) && distanceToSegmentM(p, prev, fix) <= p.radiusM);
}

export function isPlausibleSegment(prev: TimedFix, fix: TimedFix): boolean {
  const dtS = (fix.at - prev.at) / 1000;
  if (dtS <= 0 || dtS > MAX_SEGMENT_GAP_S) return false;
  return haversineM(prev, fix) / dtS <= MAX_SEGMENT_SPEED_MPS;
}

/** Metres from `p` to the segment `a`–`b`, flat-earth around `p`, fine for a few hundred metres. */
export function distanceToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const mPerLat = 111_195;
  const mPerLng = 111_195 * Math.cos((p.lat * Math.PI) / 180);
  const ax = (a.lng - p.lng) * mPerLng;
  const ay = (a.lat - p.lat) * mPerLat;
  const bx = (b.lng - p.lng) * mPerLng;
  const by = (b.lat - p.lat) * mPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  // Projection of p (the origin) onto the line, clamped to the segment.
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSq));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

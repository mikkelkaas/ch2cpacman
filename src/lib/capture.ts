import { haversineM } from './geo';
import type { LatLng, Pellet } from './types';

/** Uneaten pellets whose radius contains the fix. Inclusive: at the edge counts. */
export function pelletsWithin(fix: LatLng, pellets: readonly Pellet[], eatenIds: ReadonlySet<string>): Pellet[] {
  return pellets.filter(p => !eatenIds.has(p._id) && haversineM(fix, p) <= p.radiusM);
}

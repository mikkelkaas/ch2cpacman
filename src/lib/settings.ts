import type { GameSettings, Settings } from './types';

export const SETTINGS_DEFAULTS = {
  ghostCount: 2,
  ghostSpeedMps: 1.5,
  ghostHeadStartS: 60,
  ghostPenalty: 2,
  ghostBonus: 3,
  powerSeconds: 20,
  doubleSeconds: 60,
} as const;

/** Distance at which a ghost catches the team, or is eaten while blue. */
export const GHOST_TAG_M = 10;
/** No second catch within this long after one. */
export const GHOST_IMMUNITY_S = 20;
/** A ghost this close sets off the siren. */
export const GHOST_WARN_M = 40;
/** A respawned ghost lands at least this far from the runner when it can. */
export const GHOST_RESPAWN_MIN_M = 100;
/** Speed of a frightened ghost fleeing the runner. */
export const GHOST_FLEE_MPS = 1.0;

export function withDefaults(settings: Settings): GameSettings {
  return { ...SETTINGS_DEFAULTS, ...stripUndefined(settings) } as GameSettings;
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

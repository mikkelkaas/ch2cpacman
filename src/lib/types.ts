export interface LatLng {
  lat: number;
  lng: number;
}

export interface Settings {
  _id: string;
  phaseMinutes: number;
  start: LatLng | null;
  /** 0 turns ghosts off. Older documents lack these fields; see withDefaults in settings.ts. */
  ghostCount?: number;
  ghostSpeedMps?: number;
  ghostHeadStartS?: number;
  ghostPenalty?: number;
  ghostBonus?: number;
  powerSeconds?: number;
  doubleSeconds?: number;
}

/** Filled-in settings, every optional field present. */
export type GameSettings = Required<Settings>;

export type PelletKind = 'normal' | 'power' | 'double';

export interface Team {
  _id: string;
  name: string;
  code: string;
  color: string;
  createdAt: string;
  /** ISO timestamp written once when the team taps Start; null until then. */
  startedAt: string | null;
}

export interface Pellet {
  _id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  points: number;
  /** Missing on older records means 'normal'. */
  kind?: PelletKind;
}

export type GameEventType = 'ghost_caught' | 'ghost_eaten';

/**
 * Append-only, reported by the phone: a ghost caught the team, or the team ate
 * a frightened ghost. `points` is the signed effect the phone applied, so the
 * scoreboard and the phone agree even if the admin later changes the settings.
 */
export interface GameEvent {
  _id: string;
  teamId: string;
  type: GameEventType;
  at: string;
  points: number;
  clientId: string;
}

/** Append-only. Readers dedupe on (teamId, pelletId), earliest capturedAt wins. */
export interface Capture {
  _id: string;
  teamId: string;
  pelletId: string;
  capturedAt: string;
  lat: number;
  lng: number;
  /** Generated on the phone so a retried POST that landed twice is one capture. */
  clientId: string;
}

export type NewRecord<T> = Omit<T, '_id'>;

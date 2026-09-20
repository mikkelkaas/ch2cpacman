export interface LatLng {
  lat: number;
  lng: number;
}

export interface Game {
  _id: string;
  name: string;
  createdAt: string;
}

/** Every per-game record carries its game id; records from before games existed lack it. */
export interface GameScoped {
  gameId?: string;
}

export const MAP_THEMES = ['nat', 'neon', 'lys', 'amber', 'groen'] as const;
export type MapTheme = (typeof MAP_THEMES)[number];

export interface Settings extends GameScoped {
  _id: string;
  phaseMinutes: number;
  start: LatLng | null;
  /** Colour treatment of the runner's map tiles. */
  mapTheme?: MapTheme;
  /** 0 turns ghosts off. Older documents lack these fields; see withDefaults in settings.ts. */
  ghostCount?: number;
  ghostSpeedMps?: number;
  ghostHeadStartS?: number;
  ghostPenalty?: number;
  ghostBonus?: number;
  powerSeconds?: number;
  doubleSeconds?: number;
  /** How close to the start point counts as home, in metres. */
  homeRadiusM?: number;
  /** Length in seconds of one late step after the countdown. */
  lateStepS?: number;
  /** Points lost per whole late step; 0 turns the rule off. */
  latePenaltyPerStep?: number;
  /** The late penalty never exceeds this. */
  latePenaltyMax?: number;
}

/** Filled-in settings, every optional field present. */
export type GameSettings = Required<Settings>;

export type PelletKind = 'normal' | 'power' | 'double';

export interface Team extends GameScoped {
  _id: string;
  name: string;
  code: string;
  color: string;
  createdAt: string;
  /** ISO timestamp written once when the team taps Start; null until then. */
  startedAt: string | null;
  /**
   * ISO timestamp of reaching the start point after the countdown, written by
   * the phone when it sees itself there or by the leader who sees the team.
   * Missing or null: not home yet.
   */
  returnedAt?: string | null;
  /** Key in the photo bucket of the team photo taken before the start. */
  photoKey?: string | null;
}

export interface Pellet extends GameScoped {
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
export interface GameEvent extends GameScoped {
  _id: string;
  teamId: string;
  type: GameEventType;
  at: string;
  points: number;
  clientId: string;
}

/** Append-only. Readers dedupe on (teamId, pelletId), earliest capturedAt wins. */
export interface Capture extends GameScoped {
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

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Settings {
  _id: string;
  phaseMinutes: number;
  start: LatLng | null;
}

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

import { haversineM, headingDeg } from './geo';
import { GHOST_FLEE_MPS, GHOST_IMMUNITY_S, GHOST_RESPAWN_MIN_M, GHOST_TAG_M } from './settings';
import type { GameEventType, GameSettings, LatLng, Pellet } from './types';

/**
 * Ghosts live only on the phone. They are simulated in small steps toward the
 * runner's last GPS fix, ignoring terrain by design (see the spec). A catch or
 * a meal comes out of `stepGhosts` as an event the caller records.
 */

export const GHOST_COLORS = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852'];

export interface Ghost extends LatLng {
  id: number;
  color: string;
  /** When the ghost was released or last respawned; the speed ramp counts from here. */
  spawnedAtMs: number;
  /** 0..1, how far up the speed ramp the ghost was at the last step. For the UI. */
  rush?: number;
}

export interface GhostState {
  ghosts: Ghost[];
  /** Ghosts are blue and edible until this time. 0 when not frightened. */
  frightenedUntilMs: number;
  /** No catch counts until this time. 0 when not immune. */
  immuneUntilMs: number;
}

export interface GhostEvent {
  type: GameEventType;
  points: number;
}

export interface StepInput {
  settings: GameSettings;
  runner: LatLng;
  pellets: readonly Pellet[];
  startedAt: string;
  nowMs: number;
  dtS: number;
  rand?: () => number;
}

/** Move `from` by `meters` along `bearingDeg` (0 = north), flat-earth, fine for a few metres. */
export function moveToward(from: LatLng, bearingDeg: number, meters: number): LatLng {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111_195;
  const dLng = (meters * Math.sin(rad)) / (111_195 * Math.cos((from.lat * Math.PI) / 180));
  return { lat: from.lat + dLat, lng: from.lng + dLng };
}

/**
 * A spot at least GHOST_RESPAWN_MIN_M from the runner: a random pellet that far
 * away, else the farthest pellet, else a point 150 m off in a random direction.
 */
export function spawnPoint(runner: LatLng, pellets: readonly Pellet[], rand: () => number): LatLng {
  const far = pellets.filter(p => haversineM(runner, p) >= GHOST_RESPAWN_MIN_M);
  if (far.length > 0) return pick(far, rand);
  const farthest = [...pellets].sort((a, b) => haversineM(runner, b) - haversineM(runner, a))[0];
  if (farthest && haversineM(runner, farthest) >= GHOST_RESPAWN_MIN_M) return farthest;
  return moveToward(runner, rand() * 360, 150);
}

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
}

export function initialGhosts(settings: GameSettings, runner: LatLng, pellets: readonly Pellet[], rand: () => number = Math.random, nowMs: number = Date.now()): GhostState {
  const ghosts: Ghost[] = [];
  for (let i = 0; i < settings.ghostCount; i++) {
    const at = spawnPoint(runner, pellets, rand);
    ghosts.push({ id: i, color: GHOST_COLORS[i % GHOST_COLORS.length], spawnedAtMs: nowMs, lat: at.lat, lng: at.lng });
  }
  return { ghosts, frightenedUntilMs: 0, immuneUntilMs: 0 };
}

/** A power pellet was eaten: every ghost turns blue for `powerSeconds`. */
export function frighten(state: GhostState, settings: GameSettings, nowMs: number): GhostState {
  return { ...state, frightenedUntilMs: nowMs + settings.powerSeconds * 1000 };
}

export function isFrightened(state: GhostState, nowMs: number): boolean {
  return state.frightenedUntilMs > nowMs;
}

/**
 * Hungry ghosts: 0 at release or respawn, 1 once `ghostRampS` has passed
 * without a catch. A ramp of 0 is instantly 1.
 */
export function rush(settings: GameSettings, ghost: Ghost, releaseMs: number, nowMs: number): number {
  if (settings.ghostRampS <= 0) return 1;
  const since = nowMs - Math.max(ghost.spawnedAtMs, releaseMs);
  return Math.min(1, Math.max(0, since / (settings.ghostRampS * 1000)));
}

/** Base speed climbing to the top speed with `rush`; a top speed not above base means constant. */
export function ghostSpeedMps(settings: GameSettings, ghost: Ghost, releaseMs: number, nowMs: number): number {
  const top = Math.max(settings.ghostSpeedMps, settings.ghostMaxSpeedMps);
  return settings.ghostSpeedMps + (top - settings.ghostSpeedMps) * rush(settings, ghost, releaseMs, nowMs);
}

export function stepGhosts(state: GhostState, input: StepInput): { state: GhostState; events: GhostEvent[] } {
  const { settings, runner, pellets, startedAt, nowMs, dtS } = input;
  const rand = input.rand ?? Math.random;
  const releaseMs = Date.parse(startedAt) + settings.ghostHeadStartS * 1000;
  const released = nowMs >= releaseMs;
  const frightened = isFrightened(state, nowMs);
  const immune = state.immuneUntilMs > nowMs;
  const events: GhostEvent[] = [];
  let immuneUntilMs = state.immuneUntilMs;

  const ghosts = state.ghosts.map(ghost => {
    let next: Ghost = ghost;
    const distance = haversineM(runner, ghost);

    if (distance <= GHOST_TAG_M) {
      if (frightened) {
        events.push({ type: 'ghost_eaten', points: settings.ghostBonus });
        return { ...ghost, ...spawnPoint(runner, pellets, rand), spawnedAtMs: nowMs, rush: 0 };
      }
      if (released && !immune) {
        events.push({ type: 'ghost_caught', points: -settings.ghostPenalty });
        immuneUntilMs = nowMs + GHOST_IMMUNITY_S * 1000;
        return { ...ghost, ...spawnPoint(runner, pellets, rand), spawnedAtMs: nowMs, rush: 0 };
      }
      return ghost;
    }

    if (!released) return ghost;
    if (frightened) {
      const away = (headingDeg(runner, ghost) + 360) % 360;
      next = { ...ghost, ...moveToward(ghost, away, GHOST_FLEE_MPS * dtS) };
    } else {
      const step = Math.min(ghostSpeedMps(settings, ghost, releaseMs, nowMs) * dtS, distance);
      next = { ...ghost, ...moveToward(ghost, headingDeg(ghost, runner), step), rush: rush(settings, ghost, releaseMs, nowMs) };
    }
    return next;
  });

  // One catch per step at most: the immunity granted above also shields the
  // rest of this step's ghosts.
  const caught = events.filter(e => e.type === 'ghost_caught');
  if (caught.length > 1) {
    const extra = caught.length - 1;
    for (let i = 0; i < extra; i++) events.splice(events.lastIndexOf(caught[caught.length - 1 - i]), 1);
  }

  return { state: { ghosts, frightenedUntilMs: state.frightenedUntilMs, immuneUntilMs }, events };
}

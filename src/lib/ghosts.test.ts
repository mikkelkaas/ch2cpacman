import { describe, expect, it } from 'vitest';
import { haversineM } from './geo';
import { frighten, ghostSpeedMps, initialGhosts, stepGhosts } from './ghosts';
import type { GhostState } from './ghosts';
import { withDefaults } from './settings';
import type { LatLng, Pellet } from './types';

const runner: LatLng = { lat: 55.68, lng: 12.57 };
// ~0.0009 deg lat ≈ 100 m
const north = (m: number): LatLng => ({ lat: runner.lat + m / 111_195, lng: runner.lng });
const pellets: Pellet[] = [
  { _id: 'near', name: 'n', lat: north(30).lat, lng: runner.lng, radiusM: 5, points: 1 },
  { _id: 'far', name: 'f', lat: north(300).lat, lng: runner.lng, radiusM: 5, points: 1 },
  { _id: 'farther', name: 'ff', lat: north(500).lat, lng: runner.lng, radiusM: 5, points: 1 },
];
const settings = withDefaults({ _id: 's', phaseMinutes: 10, start: null, ghostCount: 1, ghostHeadStartS: 0, ghostSpeedMps: 2, ghostMaxSpeedMps: 2 });
const t0 = 1_000_000;
const startedAt = new Date(t0).toISOString();
const zero = () => 0;

describe('initialGhosts', () => {
  it('spawns the configured number of ghosts, each at least 100 m from the runner', () => {
    const state = initialGhosts(withDefaults({ _id: 's', phaseMinutes: 10, start: null, ghostCount: 2 }), runner, pellets, zero);
    expect(state.ghosts).toHaveLength(2);
    for (const g of state.ghosts) expect(haversineM(runner, g)).toBeGreaterThanOrEqual(100);
  });
  it('spawns nothing when ghosts are off', () => {
    expect(initialGhosts(withDefaults({ _id: 's', phaseMinutes: 10, start: null, ghostCount: 0 }), runner, pellets, zero).ghosts).toEqual([]);
  });
});

describe('stepGhosts', () => {
  it('moves a ghost toward the runner at the configured speed', () => {
    const state = initialGhosts(settings, runner, pellets, zero);
    const before = haversineM(runner, state.ghosts[0]);
    const { state: next } = stepGhosts(state, { settings, runner, pellets, startedAt, nowMs: t0 + 10_000, dtS: 1, rand: zero });
    expect(before - haversineM(runner, next.ghosts[0])).toBeCloseTo(2, 0);
  });

  it('waits out the head start before moving', () => {
    const waiting = withDefaults({ ...settings, ghostHeadStartS: 60 });
    const state = initialGhosts(waiting, runner, pellets, zero);
    const { state: next } = stepGhosts(state, { settings: waiting, runner, pellets, startedAt, nowMs: t0 + 30_000, dtS: 1, rand: zero });
    expect(next.ghosts[0].lat).toBe(state.ghosts[0].lat);
  });

  it('catches the runner within 10 m, respawns far away and grants immunity', () => {
    const state: GhostState = { ghosts: [{ id: 0, color: '#f00', spawnedAtMs: t0, ...north(5) }], frightenedUntilMs: 0, immuneUntilMs: 0 };
    const now = t0 + 10_000;
    const { state: next, events } = stepGhosts(state, { settings, runner, pellets, startedAt, nowMs: now, dtS: 0.25, rand: zero });
    expect(events).toEqual([{ type: 'ghost_caught', points: -settings.ghostPenalty }]);
    expect(haversineM(runner, next.ghosts[0])).toBeGreaterThanOrEqual(100);
    expect(next.immuneUntilMs).toBe(now + 20_000);
    // Immune: a ghost right on top of the runner does nothing.
    const again: GhostState = { ...next, ghosts: [{ id: 0, color: '#f00', spawnedAtMs: t0, ...north(1) }] };
    expect(stepGhosts(again, { settings, runner, pellets, startedAt, nowMs: now + 5_000, dtS: 0.25, rand: zero }).events).toEqual([]);
  });

  it('frightened ghosts flee and are eaten for the bonus', () => {
    let state: GhostState = { ghosts: [{ id: 0, color: '#f00', spawnedAtMs: t0, ...north(50) }], frightenedUntilMs: 0, immuneUntilMs: 0 };
    const now = t0 + 10_000;
    state = frighten(state, settings, now);
    expect(state.frightenedUntilMs).toBe(now + 20_000);
    const { state: fled } = stepGhosts(state, { settings, runner, pellets, startedAt, nowMs: now + 1000, dtS: 1, rand: zero });
    expect(haversineM(runner, fled.ghosts[0])).toBeCloseTo(51, 0);

    const close: GhostState = { ...state, ghosts: [{ id: 0, color: '#f00', spawnedAtMs: t0, ...north(5) }] };
    const { state: after, events } = stepGhosts(close, { settings, runner, pellets, startedAt, nowMs: now + 1000, dtS: 0.25, rand: zero });
    expect(events).toEqual([{ type: 'ghost_eaten', points: settings.ghostBonus }]);
    expect(haversineM(runner, after.ghosts[0])).toBeGreaterThanOrEqual(100);
    expect(after.immuneUntilMs).toBe(0);
  });
});

describe('hungry ghosts', () => {
  const hungry = withDefaults({ ...settings, ghostSpeedMps: 2, ghostMaxSpeedMps: 4, ghostRampS: 60 });
  const release = t0;
  const ghost = { id: 0, color: '#f00', spawnedAtMs: release, ...north(200) };

  it('ramps from base to top speed over the ramp time since release', () => {
    expect(ghostSpeedMps(hungry, ghost, release, release)).toBe(2);
    expect(ghostSpeedMps(hungry, ghost, release, release + 30_000)).toBe(3);
    expect(ghostSpeedMps(hungry, ghost, release, release + 60_000)).toBe(4);
    expect(ghostSpeedMps(hungry, ghost, release, release + 600_000)).toBe(4);
  });
  it('counts from the respawn when that is later than the release', () => {
    expect(ghostSpeedMps(hungry, { ...ghost, spawnedAtMs: release + 120_000 }, release, release + 150_000)).toBe(3);
  });
  it('stays at base speed when the top speed is not above it or the ramp is zero', () => {
    expect(ghostSpeedMps(withDefaults({ ...hungry, ghostMaxSpeedMps: 1 }), ghost, release, release + 600_000)).toBe(2);
    expect(ghostSpeedMps(withDefaults({ ...hungry, ghostRampS: 0 }), ghost, release, release + 1)).toBe(4);
  });
  it('moves at the ramped speed and marks how far up the ramp each ghost is', () => {
    const state: GhostState = { ghosts: [ghost], frightenedUntilMs: 0, immuneUntilMs: 0 };
    const before = haversineM(runner, ghost);
    const { state: next } = stepGhosts(state, { settings: hungry, runner, pellets, startedAt, nowMs: release + 30_000, dtS: 1, rand: zero });
    expect(before - haversineM(runner, next.ghosts[0])).toBeCloseTo(3, 0);
    expect(next.ghosts[0].rush).toBeCloseTo(0.5, 5);
  });
  it('resets to base speed after a catch by stamping the respawn time', () => {
    const state: GhostState = { ghosts: [{ ...ghost, ...north(5) }], frightenedUntilMs: 0, immuneUntilMs: 0 };
    const now = release + 90_000;
    const { state: next } = stepGhosts(state, { settings: hungry, runner, pellets, startedAt, nowMs: now, dtS: 0.25, rand: zero });
    expect(next.ghosts[0].spawnedAtMs).toBe(now);
    expect(ghostSpeedMps(hungry, next.ghosts[0], release, now)).toBe(2);
  });
  it('stamps the release time on spawn so the ramp starts at release, not at Start', () => {
    const state = initialGhosts(hungry, runner, pellets, zero, release + 5000);
    expect(state.ghosts[0].spawnedAtMs).toBe(release + 5000);
  });
});

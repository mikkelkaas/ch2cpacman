import { describe, expect, it } from 'vitest';
import { haversineM } from './geo';
import { frighten, initialGhosts, stepGhosts } from './ghosts';
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
const settings = withDefaults({ _id: 's', phaseMinutes: 10, start: null, ghostCount: 1, ghostHeadStartS: 0, ghostSpeedMps: 2 });
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
    const state: GhostState = { ghosts: [{ id: 0, color: '#f00', ...north(5) }], frightenedUntilMs: 0, immuneUntilMs: 0 };
    const now = t0 + 10_000;
    const { state: next, events } = stepGhosts(state, { settings, runner, pellets, startedAt, nowMs: now, dtS: 0.25, rand: zero });
    expect(events).toEqual([{ type: 'ghost_caught', points: -settings.ghostPenalty }]);
    expect(haversineM(runner, next.ghosts[0])).toBeGreaterThanOrEqual(100);
    expect(next.immuneUntilMs).toBe(now + 20_000);
    // Immune: a ghost right on top of the runner does nothing.
    const again: GhostState = { ...next, ghosts: [{ id: 0, color: '#f00', ...north(1) }] };
    expect(stepGhosts(again, { settings, runner, pellets, startedAt, nowMs: now + 5_000, dtS: 0.25, rand: zero }).events).toEqual([]);
  });

  it('frightened ghosts flee and are eaten for the bonus', () => {
    let state: GhostState = { ghosts: [{ id: 0, color: '#f00', ...north(50) }], frightenedUntilMs: 0, immuneUntilMs: 0 };
    const now = t0 + 10_000;
    state = frighten(state, settings, now);
    expect(state.frightenedUntilMs).toBe(now + 20_000);
    const { state: fled } = stepGhosts(state, { settings, runner, pellets, startedAt, nowMs: now + 1000, dtS: 1, rand: zero });
    expect(haversineM(runner, fled.ghosts[0])).toBeCloseTo(51, 0);

    const close: GhostState = { ...state, ghosts: [{ id: 0, color: '#f00', ...north(5) }] };
    const { state: after, events } = stepGhosts(close, { settings, runner, pellets, startedAt, nowMs: now + 1000, dtS: 0.25, rand: zero });
    expect(events).toEqual([{ type: 'ghost_eaten', points: settings.ghostBonus }]);
    expect(haversineM(runner, after.ghosts[0])).toBeGreaterThanOrEqual(100);
    expect(after.immuneUntilMs).toBe(0);
  });
});

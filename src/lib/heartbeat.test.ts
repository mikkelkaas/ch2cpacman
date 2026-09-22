import { describe, expect, it } from 'vitest';
import { heartbeatFromGame, isStale, sameBeat, staleForMs, STALE_MS } from './heartbeat';
import type { GhostState } from './ghosts';

const team = { _id: 't1', gameId: 'g1' };
const fix = { lat: 56.1, lng: 10.2, accuracyM: 12, at: 1_000 };
const ghosts: GhostState = { ghosts: [{ id: 0, color: '#ff0000', lat: 56.11, lng: 10.21, spawnedAtMs: 500, rush: 0.2 }], frightenedUntilMs: 0, immuneUntilMs: 0 };

describe('heartbeatFromGame', () => {
  it('copies the fix and ghost state and stamps the time', () => {
    const beat = heartbeatFromGame(team, fix, ghosts, 5_000);
    expect(beat).toEqual({ teamId: 't1', gameId: 'g1', fix, ghosts, at: new Date(5_000).toISOString() });
  });
  it('carries nulls when the phone has no fix or no ghosts yet', () => {
    const beat = heartbeatFromGame(team, null, null, 5_000);
    expect(beat.fix).toBeNull();
    expect(beat.ghosts).toBeNull();
  });
  it('drops a fix that is too inaccurate to trust', () => {
    const beat = heartbeatFromGame(team, { ...fix, accuracyM: 80 }, ghosts, 5_000);
    expect(beat.fix).toBeNull();
  });
});

describe('sameBeat', () => {
  it('is false against nothing sent yet', () => {
    expect(sameBeat(null, { fix, ghosts })).toBe(false);
  });
  it('is true when fix and ghosts are unchanged, ignoring the stamp', () => {
    expect(sameBeat({ fix, ghosts }, { fix: { ...fix }, ghosts: structuredClone(ghosts) })).toBe(true);
  });
  it('is false when a ghost moved', () => {
    const moved = { ...ghosts, ghosts: [{ ...ghosts.ghosts[0], lat: 56.12 }] };
    expect(sameBeat({ fix, ghosts }, { fix, ghosts: moved })).toBe(false);
  });
});

describe('isStale', () => {
  const at = new Date(10_000).toISOString();
  it('is stale with no beat at all', () => {
    expect(isStale(null, 10_000)).toBe(true);
  });
  it('is fresh inside the threshold and stale after it', () => {
    expect(isStale({ at }, 10_000 + STALE_MS - 1)).toBe(false);
    expect(isStale({ at }, 10_000 + STALE_MS)).toBe(true);
  });
  it('reports how long since the last beat, or null without one', () => {
    expect(staleForMs({ at }, 13_500)).toBe(3_500);
    expect(staleForMs(null, 13_500)).toBeNull();
  });
});

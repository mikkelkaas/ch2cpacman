import { describe, expect, it } from 'vitest';
import { dedupeCaptures, rankTeams, scoreTeam } from './score';
import type { Capture, Pellet, Team } from './types';

const startedAt = '2026-09-20T10:00:00.000Z';
const t0 = Date.parse(startedAt);
const iso = (offsetMs: number) => new Date(t0 + offsetMs).toISOString();
const settings = { phaseMinutes: 10 };

const team: Team = { _id: 't1', name: 'Ugler', code: 'ABCD', color: '#f00', createdAt: iso(-3600_000), startedAt };
const other: Team = { ...team, _id: 't2', name: 'Ræve', code: 'EFGH' };
const pellets: Pellet[] = [
  { _id: 'p1', name: 'Nær', lat: 0, lng: 0, radiusM: 25, points: 1 },
  { _id: 'p2', name: 'Fjern', lat: 0, lng: 0, radiusM: 25, points: 5 },
];
let n = 0;
function cap(teamId: string, pelletId: string, offsetMs: number): Capture {
  n += 1;
  return { _id: `c${n}`, teamId, pelletId, capturedAt: iso(offsetMs), lat: 0, lng: 0, clientId: `k${n}` };
}

describe('dedupeCaptures', () => {
  it('keeps the earliest capture per team and pellet', () => {
    const late = cap('t1', 'p1', 60_000);
    const early = cap('t1', 'p1', 30_000);
    const otherTeam = cap('t2', 'p1', 90_000);
    expect(dedupeCaptures([late, early, otherTeam])).toEqual([early, otherTeam]);
  });
});

describe('scoreTeam', () => {
  it('sums points of pellets captured inside the window', () => {
    const s = scoreTeam(team, [cap('t1', 'p1', 60_000), cap('t1', 'p2', 9 * 60_000)], pellets, settings);
    expect(s.points).toBe(6);
    expect(s.pellets.map(p => p._id)).toEqual(['p1', 'p2']);
    expect(s.lastCaptureAt).toBe(iso(9 * 60_000));
  });
  it('accepts a capture inside the 30 s grace and rejects one after it', () => {
    expect(scoreTeam(team, [cap('t1', 'p2', 10 * 60_000 + 29_000)], pellets, settings).points).toBe(5);
    expect(scoreTeam(team, [cap('t1', 'p2', 10 * 60_000 + 31_000)], pellets, settings).points).toBe(0);
  });
  it('rejects a capture before the start', () => {
    expect(scoreTeam(team, [cap('t1', 'p2', -1000)], pellets, settings).points).toBe(0);
  });
  it('ignores duplicates, deleted pellets and other teams', () => {
    const s = scoreTeam(team, [cap('t1', 'p1', 1000), cap('t1', 'p1', 2000), cap('t1', 'gone', 3000), cap('t2', 'p2', 4000)], pellets, settings);
    expect(s.points).toBe(1);
  });
  it('scores zero for a team that never started', () => {
    expect(scoreTeam({ ...team, startedAt: null }, [cap('t1', 'p2', 1000)], pellets, settings).points).toBe(0);
  });
});

describe('rankTeams', () => {
  it('orders by points, then by earlier last capture', () => {
    const captures = [cap('t1', 'p2', 5 * 60_000), cap('t2', 'p2', 4 * 60_000)];
    const ranked = rankTeams([team, other], captures, pellets, settings);
    expect(ranked.map(r => r.team._id)).toEqual(['t2', 't1']);
    const ranked2 = rankTeams([team, other], [...captures, cap('t1', 'p1', 6 * 60_000)], pellets, settings);
    expect(ranked2.map(r => r.team._id)).toEqual(['t1', 't2']);
  });
});

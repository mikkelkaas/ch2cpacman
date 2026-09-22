import { describe, expect, it } from 'vitest';
import { captureTimesOf, dedupeCaptures, doubleRemainingMs, rankTeams, scoreTeam } from './score';
import type { Capture, Pellet, Team } from './types';
// Dobbelt and ghost event tests below reuse these fixtures.

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

describe('score with Dobbelt and ghost events', () => {
  const dbl: Pellet = { _id: 'd', name: 'Dobbelt', lat: 0, lng: 0, radiusM: 5, points: 1, kind: 'double' };
  const all = [...pellets, dbl];
  const ev = (type: 'ghost_caught' | 'ghost_eaten', points: number, offsetMs: number) => ({ _id: `e${offsetMs}`, teamId: 't1', type, at: iso(offsetMs), points, clientId: `e${offsetMs}` });

  it('doubles pellets eaten within the window after a Dobbelt, not the Dobbelt itself', () => {
    const s = scoreTeam(team, [cap('t1', 'd', 60_000), cap('t1', 'p1', 90_000), cap('t1', 'p2', 60_000 + 61_000)], all, { ...settings, doubleSeconds: 60 }, []);
    // Dobbelt 1 + p1 doubled 2 + p2 outside the window 5
    expect(s.points).toBe(8);
  });

  it('applies ghost events inside the window and floors the score at zero', () => {
    const s = scoreTeam(team, [cap('t1', 'p1', 60_000)], all, settings, [ev('ghost_caught', -2, 70_000), ev('ghost_eaten', 3, 80_000), ev('ghost_caught', -2, 20 * 60_000)]);
    expect(s.points).toBe(2);
    expect(s.caught).toBe(1);
    expect(s.ghostsEaten).toBe(1);
    const floored = scoreTeam(team, [], all, settings, [ev('ghost_caught', -2, 70_000)]);
    expect(floored.points).toBe(0);
  });
});

describe('score with a late penalty', () => {
  const late = { ...settings, latePenaltyPerStep: 1, latePenaltyMax: 4 };
  const end = 10 * 60_000;
  const caps = [cap('t1', 'p2', 60_000), cap('t1', 'p1', 90_000)];

  it('subtracts the penalty for a team that came home late and reports it', () => {
    const s = scoreTeam({ ...team, returnedAt: iso(end + 25_000) }, caps, pellets, late, [], t0 + end + 60_000);
    expect(s.late).toBe(2);
    expect(s.pelletPoints).toBe(6);
    expect(s.points).toBe(4);
  });
  it('subtracts nothing for a team home in time', () => {
    const s = scoreTeam({ ...team, returnedAt: iso(end + 3000) }, caps, pellets, late, [], t0 + end + 60_000);
    expect(s.late).toBe(0);
    expect(s.points).toBe(6);
  });
  it('grows with now for a team still out, and caps', () => {
    expect(scoreTeam(team, caps, pellets, late, [], t0 + end + 15_000).late).toBe(1);
    expect(scoreTeam(team, caps, pellets, late, [], t0 + end + 60 * 60_000).late).toBe(4);
  });
  it('floors at zero and never touches a run that is still going', () => {
    expect(scoreTeam(team, [cap('t1', 'p1', 1000)], pellets, late, [], t0 + end + 60 * 60_000).points).toBe(0);
    expect(scoreTeam(team, caps, pellets, late, [], t0 + 5 * 60_000).late).toBe(0);
  });
  it('uses the configured step and defaults it to 10 s when the document lacks it', () => {
    expect(scoreTeam({ ...team, returnedAt: iso(end + 25_000) }, caps, pellets, { ...late, lateStepS: 5 }, [], t0 + end + 60_000).late).toBe(4);
    expect(scoreTeam({ ...team, returnedAt: iso(end + 25_000) }, caps, pellets, late, [], t0 + end + 60_000).late).toBe(2);
  });
  it('is off when the penalty is zero, as it is for old settings documents without it', () => {
    expect(scoreTeam(team, caps, pellets, { ...settings, latePenaltyPerStep: 0 }, [], t0 + end + 60 * 60_000).points).toBe(6);
  });
});

describe('captureTimesOf', () => {
  it('maps each pellet to the earliest capture of one team', () => {
    const captures = [
      { _id: 'a', teamId: 't1', pelletId: 'p1', capturedAt: '2026-09-22T10:00:05.000Z', lat: 0, lng: 0, clientId: 'a' },
      { _id: 'b', teamId: 't1', pelletId: 'p1', capturedAt: '2026-09-22T10:00:01.000Z', lat: 0, lng: 0, clientId: 'b' },
      { _id: 'c', teamId: 't2', pelletId: 'p2', capturedAt: '2026-09-22T10:00:02.000Z', lat: 0, lng: 0, clientId: 'c' },
    ];
    expect(captureTimesOf(captures, 't1')).toEqual(new Map([['p1', '2026-09-22T10:00:01.000Z']]));
  });
});

describe('doubleRemainingMs', () => {
  const pellets = [
    { _id: 'd1', name: 'x2', lat: 0, lng: 0, radiusM: 20, points: 1, kind: 'double' as const },
    { _id: 'n1', name: 'n', lat: 0, lng: 0, radiusM: 20, points: 1 },
  ];
  const t0 = Date.parse('2026-09-22T10:00:00.000Z');
  it('counts down from the most recent double pellet eaten', () => {
    const times = new Map([['d1', new Date(t0).toISOString()], ['n1', new Date(t0 + 1000).toISOString()]]);
    expect(doubleRemainingMs(times, pellets, 60, t0 + 15_000)).toBe(45_000);
  });
  it('is 0 once the window has passed or nothing double was eaten', () => {
    const times = new Map([['d1', new Date(t0).toISOString()]]);
    expect(doubleRemainingMs(times, pellets, 60, t0 + 61_000)).toBe(0);
    expect(doubleRemainingMs(new Map(), pellets, 60, t0)).toBe(0);
  });
});

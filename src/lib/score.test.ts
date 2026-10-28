import { describe, expect, it } from 'vitest';
import { captureTimesOf, dedupeCaptures, dedupeEvents, dotOwners, doubleRemainingMs, ofCurrentRun, rankTeams, scoreTeam } from './score';
import type { Capture, Pellet, Team } from './types';
// Dobbelt and ghost event tests below reuse these fixtures.

const startedAt = '2026-09-20T10:00:00.000Z';
const t0 = Date.parse(startedAt);
const iso = (offsetMs: number) => new Date(t0 + offsetMs).toISOString();
// Late rule off: these fixtures never come home. Its own block below turns it on.
const settings = { phaseMinutes: 10, latePenaltyPerStep: 0 };

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
  it('stops counting at an early home stamp, after the grace', () => {
    const home = { ...team, returnedAt: iso(4 * 60_000) };
    expect(scoreTeam(home, [cap('t1', 'p1', 3 * 60_000), cap('t1', 'p2', 4 * 60_000 + 29_000)], pellets, settings).points).toBe(6);
    expect(scoreTeam(home, [cap('t1', 'p2', 4 * 60_000 + 31_000)], pellets, settings).points).toBe(0);
  });
  it('rejects a capture before the start', () => {
    expect(scoreTeam(team, [cap('t1', 'p2', -1000)], pellets, settings).points).toBe(0);
  });
  it('counts the in-window capture of a dot also captured before the start', () => {
    // A rerun after a Nulstil whose old capture landed late: the earlier, pre-window one must not hide it.
    const s = scoreTeam(team, [cap('t1', 'p2', -60_000), cap('t1', 'p2', 60_000)], pellets, settings);
    expect(s.points).toBe(5);
    expect(s.scored.map(x => x.capturedAt)).toEqual([iso(60_000)]);
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

  it('counts an event stored twice under one clientId once', () => {
    const caught = ev('ghost_caught', -2, 70_000);
    const s = scoreTeam(team, [cap('t1', 'p2', 60_000)], all, settings, [caught, { ...caught, _id: 'dup' }]);
    expect(s.caught).toBe(1);
    expect(s.points).toBe(3);
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
  it('is off when the penalty is zero', () => {
    expect(scoreTeam(team, caps, pellets, { ...settings, latePenaltyPerStep: 0 }, [], t0 + end + 60 * 60_000).points).toBe(6);
  });
  it('defaults to 1 point per step, capped at 10, when the settings document lacks the fields, like the phone', () => {
    expect(scoreTeam({ ...team, returnedAt: iso(end + 25_000) }, caps, pellets, { phaseMinutes: 10 }, [], t0 + end + 60_000).late).toBe(2);
    expect(scoreTeam(team, caps, pellets, { phaseMinutes: 10 }, [], t0 + end + 60 * 60_000).late).toBe(10);
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

describe('dedupeEvents', () => {
  it('keeps the first record per clientId', () => {
    const a = { _id: '1', clientId: 'x' };
    expect(dedupeEvents([a, { _id: '2', clientId: 'x' }, { _id: '3', clientId: 'y' }]).map(e => e._id)).toEqual(['1', '3']);
  });
});

describe('ofCurrentRun', () => {
  it('keeps only this team\'s records stamped at or after the start', () => {
    const before = cap('t1', 'p1', -60_000);
    const atStart = cap('t1', 'p1', 0);
    const after = cap('t1', 'p2', 60_000);
    const otherTeam = cap('t2', 'p2', 60_000);
    expect(ofCurrentRun([before, atStart, after, otherTeam], team, c => c.capturedAt)).toEqual([atStart, after]);
  });
  it('is empty before Start', () => {
    expect(ofCurrentRun([cap('t1', 'p1', 0)], { ...team, startedAt: null }, c => c.capturedAt)).toEqual([]);
  });
});

describe('shared dots', () => {
  const dbl: Pellet = { _id: 'd', name: 'Dobbelt', lat: 0, lng: 0, radiusM: 5, points: 1, kind: 'double' };
  const all = [...pellets, dbl];
  const teams = [team, other];

  it('gives the dot to the earliest capture, and only that team scores it', () => {
    const captures = [cap('t1', 'p2', 60_000), cap('t2', 'p2', 30_000)];
    const owners = dotOwners(teams, captures, pellets, settings);
    expect(owners.get('p2')).toBe('t2');
    expect(scoreTeam(team, captures, pellets, settings, [], Date.now(), owners).points).toBe(0);
    expect(scoreTeam(other, captures, pellets, settings, [], Date.now(), owners).points).toBe(5);
  });
  it('breaks a tie on capturedAt with the lower clientId', () => {
    const a = { ...cap('t1', 'p1', 10_000), clientId: 'b' };
    const b = { ...cap('t2', 'p1', 10_000), clientId: 'a' };
    expect(dotOwners(teams, [a, b], pellets, settings).get('p1')).toBe('t2');
    expect(dotOwners(teams, [b, a], pellets, settings).get('p1')).toBe('t2');
  });
  it('ignores a capture outside its own window, e.g. after the home stamp plus grace', () => {
    // t2 is home at +20 s, so its window ends at +50 s; +51 s no longer counts for it.
    const home = { ...other, returnedAt: iso(20_000) };
    const owners = dotOwners([team, home], [cap('t2', 'p1', 51_000), cap('t1', 'p1', 60_000)], pellets, settings);
    expect(owners.get('p1')).toBe('t1');
  });
  it('lets a capture before the start block nobody', () => {
    const owners = dotOwners(teams, [cap('t2', 'p1', -1000), cap('t1', 'p1', 5000)], pellets, settings);
    expect(owners.get('p1')).toBe('t1');
  });
  it('ignores captures by teams not in the list and of unlisted pellets', () => {
    const owners = dotOwners([team], [cap('t2', 'p1', 1000), cap('t1', 'p1', 5000), cap('t1', 'gone', 1000)], pellets, settings);
    expect(owners.get('p1')).toBe('t1');
    expect(owners.has('gone')).toBe(false);
  });
  it('gives a team that never started nothing, and an empty list an empty map', () => {
    const idle = { ...team, startedAt: null };
    expect(dotOwners([idle], [cap('t1', 'p1', 1000)], pellets, settings).size).toBe(0);
    expect(dotOwners(teams, [], pellets, settings).size).toBe(0);
  });
  it('computes Dobbelt from owned captures only', () => {
    const captures = [cap('t2', 'd', 10_000), cap('t1', 'd', 20_000), cap('t1', 'p1', 30_000)];
    const owners = dotOwners(teams, captures, all, { ...settings, doubleSeconds: 60 });
    expect(owners.get('d')).toBe('t2');
    const s = scoreTeam(team, captures, all, { ...settings, doubleSeconds: 60 }, [], Date.now(), owners);
    expect(s.points).toBe(1);
    expect(s.scored.map(x => x.multiplier)).toEqual([1]);
  });
  it('ranks by owned points when playMode is shared, and unchanged otherwise', () => {
    const captures = [cap('t1', 'p2', 60_000), cap('t2', 'p2', 30_000), cap('t1', 'p1', 70_000)];
    const shared = rankTeams(teams, captures, pellets, { ...settings, playMode: 'shared' });
    expect(shared.map(r => [r.team._id, r.points])).toEqual([['t2', 5], ['t1', 1]]);
    const solo = rankTeams(teams, captures, pellets, settings);
    expect(solo.map(r => [r.team._id, r.points])).toEqual([['t1', 6], ['t2', 5]]);
  });
});

import { describe, expect, it } from 'vitest';
import { lostDots, takenDots, withOwnCaptures } from './sharedDots';
import type { Capture } from './types';

const cap = (teamId: string, pelletId: string, capturedAt: string, clientId = `k-${teamId}-${pelletId}`): Capture => ({ _id: clientId, teamId, pelletId, capturedAt, lat: 0, lng: 0, clientId });

describe('withOwnCaptures', () => {
  it('adds the phone’s own captures the server does not have yet, keyed by pellet id', () => {
    const server = [cap('t2', 'p1', '2026-10-28T10:01:00.000Z')];
    const own = new Map([['p1', '2026-10-28T10:00:30.000Z']]);
    expect(withOwnCaptures(server, 't1', own)).toEqual([...server, { _id: 'p1', teamId: 't1', pelletId: 'p1', capturedAt: '2026-10-28T10:00:30.000Z', lat: 0, lng: 0, clientId: 'p1' }]);
  });
  it('leaves out an own capture the server already holds, so its clientId decides ties as on every other screen', () => {
    const server = [cap('t1', 'p1', '2026-10-28T10:00:30.000Z')];
    expect(withOwnCaptures(server, 't1', new Map([['p1', '2026-10-28T10:00:30.000Z']]))).toEqual(server);
  });
});

describe('takenDots', () => {
  it('lists the dots owned by other teams only', () => {
    const owners = new Map([['p1', 't1'], ['p2', 't2'], ['p3', 't3']]);
    expect(takenDots(owners, 't1')).toEqual(new Map([['p2', 't2'], ['p3', 't3']]));
  });
});

describe('lostDots', () => {
  it('lists the dots this team ate that another team owns, with that team', () => {
    const owners = new Map([['p1', 't1'], ['p2', 't2'], ['p4', 't3']]);
    const mine = new Map([['p1', 'a'], ['p2', 'b'], ['p3', 'c']]);
    expect(lostDots(mine, owners, 't1')).toEqual(new Map([['p2', 't2']]));
  });
});

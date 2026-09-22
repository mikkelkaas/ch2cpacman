import { describe, expect, it } from 'vitest';
import { joinCodeFromHash, joinHash } from './route';

describe('joinCodeFromHash', () => {
  it('reads the team code from a join address, upper-cased, as a runner', () => {
    expect(joinCodeFromHash('#/join/ab12')).toEqual({ code: 'AB12', role: 'runner' });
  });
  it('reads a watch address as a spectator', () => {
    expect(joinCodeFromHash('#/watch/ab12')).toEqual({ code: 'AB12', role: 'spectator' });
  });
  it('is null for the plain and admin routes', () => {
    expect(joinCodeFromHash('')).toBeNull();
    expect(joinCodeFromHash('#/')).toBeNull();
    expect(joinCodeFromHash('#/admin/g1')).toBeNull();
  });
});

describe('joinHash', () => {
  it('points at the team so a reload rejoins', () => {
    expect(joinHash('AB12')).toBe('#/join/AB12');
    expect(joinHash('AB12', 'runner')).toBe('#/join/AB12');
  });
  it('uses the watch route for a spectator', () => {
    expect(joinHash('AB12', 'spectator')).toBe('#/watch/AB12');
  });
  it('is the plain route when no team is joined, whatever the role', () => {
    expect(joinHash(null)).toBe('#/');
    expect(joinHash(null, 'spectator')).toBe('#/');
  });
  it('round-trips through joinCodeFromHash', () => {
    expect(joinCodeFromHash(joinHash('XY99', 'spectator'))).toEqual({ code: 'XY99', role: 'spectator' });
  });
});

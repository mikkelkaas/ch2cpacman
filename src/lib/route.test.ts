import { describe, expect, it } from 'vitest';
import { joinCodeFromHash, joinHash } from './route';

describe('joinCodeFromHash', () => {
  it('reads the team code from a join address, upper-cased', () => {
    expect(joinCodeFromHash('#/join/ab12')).toBe('AB12');
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
  });
  it('is the plain route when no team is joined', () => {
    expect(joinHash(null)).toBe('#/');
  });
  it('round-trips through joinCodeFromHash', () => {
    expect(joinCodeFromHash(joinHash('XY99'))).toBe('XY99');
  });
});

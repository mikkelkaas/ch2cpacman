import { describe, expect, it } from 'vitest';
import { lateMs, phaseEndMs, phaseState, remainingMs } from './phase';

const startedAt = '2026-09-20T10:00:00.000Z';
const start = Date.parse(startedAt);
const min = 60_000;

describe('phase', () => {
  it('ends phaseMinutes after the start', () => {
    expect(phaseEndMs(startedAt, 10)).toBe(start + 10 * min);
  });
  it('is idle without a start', () => {
    expect(phaseState({ startedAt: null }, 10, start)).toBe('idle');
  });
  it('is running inside the window and over after it', () => {
    expect(phaseState({ startedAt }, 10, start + 5 * min)).toBe('running');
    expect(phaseState({ startedAt }, 10, start + 10 * min)).toBe('over');
  });
  it('counts down and clamps at zero', () => {
    expect(remainingMs(startedAt, 10, start + 9 * min)).toBe(min);
    expect(remainingMs(startedAt, 10, start + 11 * min)).toBe(0);
  });
});

describe('phase with a late rule', () => {
  const rule = { lateStepS: 10, latePenaltyPerStep: 1, latePenaltyMax: 3 };
  it('is late after the end until the team is home or the cap is reached', () => {
    expect(phaseState({ startedAt, returnedAt: null }, 10, start + 10 * min, rule)).toBe('late');
    expect(phaseState({ startedAt, returnedAt: null }, 10, start + 10 * min + 29_000, rule)).toBe('late');
    expect(phaseState({ startedAt, returnedAt: null }, 10, start + 10 * min + 30_000, rule)).toBe('over');
  });
  it('is over as soon as the team is home', () => {
    const returnedAt = new Date(start + 10 * min + 5000).toISOString();
    expect(phaseState({ startedAt, returnedAt }, 10, start + 10 * min + 6000, rule)).toBe('over');
  });
  it('is over at the end when the rule is off', () => {
    expect(phaseState({ startedAt, returnedAt: null }, 10, start + 10 * min, { lateStepS: 10, latePenaltyPerStep: 0, latePenaltyMax: 3 })).toBe('over');
  });
  it('counts how late the team is, from the end', () => {
    expect(lateMs(startedAt, 10, start + 9 * min)).toBe(0);
    expect(lateMs(startedAt, 10, start + 10 * min + 7000)).toBe(7000);
  });
});

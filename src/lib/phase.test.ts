import { describe, expect, it } from 'vitest';
import { phaseEndMs, phaseState, remainingMs } from './phase';

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

import { describe, expect, it } from 'vitest';
import { isHome, latePenalty, lateWindowMs } from './late';

const startedAt = '2026-09-20T10:00:00.000Z';
const t0 = Date.parse(startedAt);
const iso = (offsetMs: number) => new Date(t0 + offsetMs).toISOString();
const end = 10 * 60_000;
const rule = { phaseMinutes: 10, lateStepS: 10, latePenaltyPerStep: 1, latePenaltyMax: 5 };

describe('lateWindowMs', () => {
  it('is how long the penalty keeps growing before it hits the cap', () => {
    expect(lateWindowMs(rule)).toBe(50_000);
    expect(lateWindowMs({ ...rule, latePenaltyPerStep: 2 })).toBe(30_000);
  });
  it('scales with the step', () => {
    expect(lateWindowMs({ ...rule, lateStepS: 30 })).toBe(150_000);
  });
  it('is zero when the rule is off', () => {
    expect(lateWindowMs({ ...rule, latePenaltyPerStep: 0 })).toBe(0);
    expect(lateWindowMs({ ...rule, lateStepS: 0 })).toBe(0);
    expect(lateWindowMs({ ...rule, latePenaltyMax: 0 })).toBe(0);
  });
});

describe('latePenalty', () => {
  it('is zero for a team home before or at the end, and for a whole 10 s block only', () => {
    expect(latePenalty(startedAt, rule, iso(end - 1000), t0 + end + 60_000)).toBe(0);
    expect(latePenalty(startedAt, rule, iso(end), t0 + end + 60_000)).toBe(0);
    expect(latePenalty(startedAt, rule, iso(end + 9_999), t0 + end + 60_000)).toBe(0);
    expect(latePenalty(startedAt, rule, iso(end + 10_000), t0 + end + 60_000)).toBe(1);
  });
  it('grows per 10 s late and is capped', () => {
    expect(latePenalty(startedAt, rule, iso(end + 35_000), t0 + end + 60_000)).toBe(3);
    expect(latePenalty(startedAt, rule, iso(end + 5 * 60_000), t0 + end + 60_000)).toBe(5);
  });
  it('uses now while the team is still out, and the cap once the window has passed', () => {
    expect(latePenalty(startedAt, rule, null, t0 + end - 1000)).toBe(0);
    expect(latePenalty(startedAt, rule, null, t0 + end + 21_000)).toBe(2);
    expect(latePenalty(startedAt, rule, undefined, t0 + end + 60 * 60_000)).toBe(5);
  });
  it('charges per whole step of the configured length', () => {
    const step30 = { ...rule, lateStepS: 30 };
    expect(latePenalty(startedAt, step30, iso(end + 29_000), t0 + end + 60_000)).toBe(0);
    expect(latePenalty(startedAt, step30, iso(end + 30_000), t0 + end + 60_000)).toBe(1);
    expect(latePenalty(startedAt, step30, iso(end + 65_000), t0 + end + 60_000)).toBe(2);
  });
  it('is zero when the rule is off, whatever the times', () => {
    expect(latePenalty(startedAt, { ...rule, latePenaltyPerStep: 0 }, null, t0 + end + 60 * 60_000)).toBe(0);
  });
});

describe('isHome', () => {
  const start = { lat: 56.0, lng: 10.0 };
  it('is true inside the radius, inclusive, and false outside', () => {
    expect(isHome(start, start, 15)).toBe(true);
    // ~11 m north
    expect(isHome({ lat: 56.0001, lng: 10.0 }, start, 15)).toBe(true);
    // ~22 m north
    expect(isHome({ lat: 56.0002, lng: 10.0 }, start, 15)).toBe(false);
  });
});

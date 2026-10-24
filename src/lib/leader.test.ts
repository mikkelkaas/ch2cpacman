import { describe, expect, it } from 'vitest';
import { eventScore, leaderStatus, teamPositions } from './leader';
import type { GameSettings, Team } from './types';
import { withDefaults } from './settings';

const settings: GameSettings = withDefaults({ _id: 's', phaseMinutes: 7, start: null });
const team = (over: Partial<Team> = {}): Team => ({ _id: 't', name: 'Hold', code: 'ABCD', color: '#000', createdAt: '2026-10-19T09:00:00Z', startedAt: null, ...over });
const START = '2026-10-19T10:00:00Z';
const at = (minutes: number) => Date.parse(START) + minutes * 60_000;

describe('eventScore', () => {
  it('divides the points and rounds', () => {
    expect(eventScore(58, 5)).toBe(12);
    expect(eventScore(57, 5)).toBe(11);
  });
  it('stays within 0 to 20', () => {
    expect(eventScore(0, 5)).toBe(0);
    expect(eventScore(140, 5)).toBe(20);
  });
  it('treats a missing or broken divisor as the default 5', () => {
    expect(eventScore(50, 0)).toBe(10);
    expect(eventScore(50, Number.NaN)).toBe(10);
  });
});

describe('leaderStatus', () => {
  it('is not played before the team starts', () => {
    expect(leaderStatus(team(), settings, at(0))).toBe('notPlayed');
  });
  it('is running during the countdown and on the late run home', () => {
    expect(leaderStatus(team({ startedAt: START }), settings, at(3))).toBe('running');
    expect(leaderStatus(team({ startedAt: START }), settings, at(7.5))).toBe('running');
  });
  it('waits for e-vent once the run is over', () => {
    expect(leaderStatus(team({ startedAt: START, returnedAt: '2026-10-19T10:07:10Z' }), settings, at(8))).toBe('missingEvent');
  });
  it('is done when the points are in e-vent', () => {
    expect(leaderStatus(team({ startedAt: START, returnedAt: '2026-10-19T10:07:10Z', eventSubmitted: true }), settings, at(8))).toBe('done');
  });
});

describe('teamPositions', () => {
  const fix = { lat: 56, lng: 10, accuracyM: 5, at: at(1) };
  const beat = (over = {}) => ({ teamId: 't', fix, at: new Date(at(1)).toISOString(), ...over });
  const running = team({ startedAt: START });

  it('places a running team where its last beat says', () => {
    expect(teamPositions([running], [beat()], at(1) + 2000)).toEqual([{ team: running, lat: 56, lng: 10, ageMs: 2000, stale: false }]);
  });
  it('marks a quiet phone stale', () => {
    expect(teamPositions([running], [beat()], at(2))[0].stale).toBe(true);
  });
  it('skips teams without a beat, without a usable fix, or with a beat from an earlier run', () => {
    expect(teamPositions([running], [], at(1))).toEqual([]);
    expect(teamPositions([running], [beat({ fix: null })], at(1))).toEqual([]);
    expect(teamPositions([running], [beat({ fix: { ...fix, accuracyM: 500 } })], at(1))).toEqual([]);
    expect(teamPositions([running], [beat({ at: new Date(at(-5)).toISOString() })], at(1))).toEqual([]);
  });
});

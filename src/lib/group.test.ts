import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS } from './settings';
import { canChangePlayMode, groupEndMs, isGroupMode, isSharedDots, signalPendingMs, withGroupStart } from './group';
import type { GameSettings, Team } from './types';

const signal = '2026-10-28T10:00:00.000Z';
const t0 = Date.parse(signal);
const team = (startedAt: string | null = null): Team => ({ _id: 't', gameId: 'g', name: 'T', code: 'ABC', color: '#fff', createdAt: signal, startedAt });
const game = (over: Partial<GameSettings> = {}): GameSettings =>
  ({ ...SETTINGS_DEFAULTS, _id: 's', gameId: 'g', phaseMinutes: 10, start: null, lateStepS: 10, latePenaltyPerStep: 1, latePenaltyMax: 3, ...over }) as GameSettings;

describe('play mode helpers', () => {
  it('knows the group modes and shared dots', () => {
    expect(isGroupMode({})).toBe(false);
    expect(isGroupMode({ playMode: 'solo' })).toBe(false);
    expect(isGroupMode({ playMode: 'together' })).toBe(true);
    expect(isGroupMode({ playMode: 'shared' })).toBe(true);
    expect(isSharedDots({ playMode: 'together' })).toBe(false);
    expect(isSharedDots({ playMode: 'shared' })).toBe(true);
  });
});

describe('withGroupStart', () => {
  it('returns the same team in solo and with playMode missing', () => {
    const t = team('2026-10-28T09:00:00.000Z');
    expect(withGroupStart(t, { playMode: 'solo', groupStartedAt: signal })).toBe(t);
    expect(withGroupStart(t, { groupStartedAt: signal })).toBe(t);
  });
  it.each(['together', 'shared'] as const)('uses the signal in %s and ignores the own start', (playMode) => {
    const t = team('2026-10-28T09:00:00.000Z');
    expect(withGroupStart(t, { playMode, groupStartedAt: signal }).startedAt).toBe(signal);
    expect(t.startedAt).toBe('2026-10-28T09:00:00.000Z');
  });
  it('has no start before the signal', () => {
    expect(withGroupStart(team('2026-10-28T09:00:00.000Z'), { playMode: 'together', groupStartedAt: null }).startedAt).toBeNull();
    expect(withGroupStart(team(), { playMode: 'together' }).startedAt).toBeNull();
  });
  it('gives a team created after the signal the signal too', () => {
    expect(withGroupStart(team(), { playMode: 'shared', groupStartedAt: signal }).startedAt).toBe(signal);
  });
});

describe('signalPendingMs', () => {
  it('counts down to a future signal, then 0', () => {
    expect(signalPendingMs({ playMode: 'together', groupStartedAt: signal }, t0 - 3000)).toBe(3000);
    expect(signalPendingMs({ playMode: 'together', groupStartedAt: signal }, t0)).toBe(0);
    expect(signalPendingMs({ playMode: 'together', groupStartedAt: signal }, t0 + 1000)).toBe(0);
  });
  it('is 0 in solo and without a signal', () => {
    expect(signalPendingMs({ playMode: 'solo', groupStartedAt: signal }, t0 - 3000)).toBe(0);
    expect(signalPendingMs({ playMode: 'together', groupStartedAt: null }, t0 - 3000)).toBe(0);
  });
});

describe('groupEndMs', () => {
  it('is the end plus the late window plus the grace', () => {
    expect(groupEndMs(game({ playMode: 'together', groupStartedAt: signal }))).toBe(t0 + 10 * 60_000 + 30_000 + 30_000);
  });
  it('is null without a signal', () => {
    expect(groupEndMs(game({ playMode: 'together', groupStartedAt: null }))).toBeNull();
  });
});

describe('canChangePlayMode', () => {
  it('is true for a fresh game', () => {
    expect(canChangePlayMode({ groupStartedAt: null }, [team()], 0)).toBe(true);
  });
  it('is false once started or captured', () => {
    expect(canChangePlayMode({ groupStartedAt: signal }, [], 0)).toBe(false);
    expect(canChangePlayMode({ groupStartedAt: null }, [team(), team(signal)], 0)).toBe(false);
    expect(canChangePlayMode({ groupStartedAt: null }, [], 1)).toBe(false);
  });
});

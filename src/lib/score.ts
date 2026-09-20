import { latePenalty } from './late';
import { GRACE_MS, phaseEndMs } from './phase';
import { SETTINGS_DEFAULTS } from './settings';
import type { Capture, GameEvent, Pellet, Settings, Team } from './types';

/** One capture per (team, pellet): the earliest. Retries and reloads never double score. */
export function dedupeCaptures(captures: readonly Capture[]): Capture[] {
  const best = new Map<string, Capture>();
  for (const c of captures) {
    const key = `${c.teamId}|${c.pelletId}`;
    const seen = best.get(key);
    if (!seen || c.capturedAt < seen.capturedAt) best.set(key, c);
  }
  return [...best.values()];
}

export interface ScoredPellet {
  pellet: Pellet;
  capturedAt: string;
  /** 1, or 2 while a Dobbelt was active. */
  multiplier: number;
}

export interface TeamScore {
  team: Team;
  points: number;
  pellets: Pellet[];
  scored: ScoredPellet[];
  caught: number;
  ghostsEaten: number;
  /** Σ pellet points × multiplier, before ghost events and the late penalty. */
  pelletPoints: number;
  /** Points lost for coming home late, already subtracted from `points`. */
  late: number;
  lastCaptureAt: string | null;
}

type ScoringSettings = Pick<Settings, 'phaseMinutes' | 'doubleSeconds' | 'lateStepS' | 'latePenaltyPerStep' | 'latePenaltyMax'>;

const EMPTY = (team: Team): TeamScore => ({ team, points: 0, pellets: [], scored: [], caught: 0, ghostsEaten: 0, pelletPoints: 0, late: 0, lastCaptureAt: null });

/**
 * Points = Σ pellet points × Dobbelt multiplier + Σ ghost events − late
 * penalty, floored at 0. A Dobbelt doubles pellets eaten in the `doubleSeconds`
 * after it, never itself and never ghost bonuses. The late penalty grows per
 * `lateStepS` between the end and `returnedAt`, or `nowMs` while the team is
 * still out. Everything is derived from timestamps, so the phone and the admin page
 * agree without trusting each other's totals.
 */
export function scoreTeam(
  team: Team,
  captures: readonly Capture[],
  pellets: readonly Pellet[],
  settings: ScoringSettings,
  events: readonly GameEvent[] = [],
  nowMs: number = Date.now(),
): TeamScore {
  if (!team.startedAt) return EMPTY(team);
  const startMs = Date.parse(team.startedAt);
  const endMs = phaseEndMs(team.startedAt, settings.phaseMinutes) + GRACE_MS;
  const inWindow = (iso: string) => {
    const t = Date.parse(iso);
    return t >= startMs && t <= endMs;
  };
  const byId = new Map(pellets.map(p => [p._id, p]));
  const doubleMs = (settings.doubleSeconds ?? SETTINGS_DEFAULTS.doubleSeconds) * 1000;

  const counted = dedupeCaptures(captures.filter(c => c.teamId === team._id))
    .filter(c => inWindow(c.capturedAt) && byId.has(c.pelletId))
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  const doubleStarts = counted.filter(c => byId.get(c.pelletId)!.kind === 'double').map(c => Date.parse(c.capturedAt));
  const scored: ScoredPellet[] = counted.map(c => {
    const pellet = byId.get(c.pelletId)!;
    const t = Date.parse(c.capturedAt);
    const doubled = pellet.kind !== 'double' && doubleStarts.some(d => t > d && t <= d + doubleMs);
    return { pellet, capturedAt: c.capturedAt, multiplier: doubled ? 2 : 1 };
  });

  const own = events.filter(e => e.teamId === team._id && inWindow(e.at));
  const caught = own.filter(e => e.type === 'ghost_caught');
  const ghostsEaten = own.filter(e => e.type === 'ghost_eaten');
  const pelletPoints = scored.reduce((sum, s) => sum + s.pellet.points * s.multiplier, 0);
  const eventPoints = own.reduce((sum, e) => sum + e.points, 0);
  const late = latePenalty(
    team.startedAt,
    {
      phaseMinutes: settings.phaseMinutes,
      lateStepS: settings.lateStepS ?? SETTINGS_DEFAULTS.lateStepS,
      latePenaltyPerStep: settings.latePenaltyPerStep ?? 0,
      latePenaltyMax: settings.latePenaltyMax ?? SETTINGS_DEFAULTS.latePenaltyMax,
    },
    team.returnedAt,
    nowMs,
  );

  return {
    team,
    points: Math.max(0, pelletPoints + eventPoints - late),
    pellets: scored.map(s => s.pellet),
    scored,
    caught: caught.length,
    ghostsEaten: ghostsEaten.length,
    pelletPoints,
    late,
    lastCaptureAt: counted.at(-1)?.capturedAt ?? null,
  };
}

/** Points descending; ties go to the team that reached its total first. */
export function rankTeams(
  teams: readonly Team[],
  captures: readonly Capture[],
  pellets: readonly Pellet[],
  settings: ScoringSettings,
  events: readonly GameEvent[] = [],
  nowMs: number = Date.now(),
): TeamScore[] {
  return teams
    .map(team => scoreTeam(team, captures, pellets, settings, events, nowMs))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const la = a.lastCaptureAt ?? '~';
      const lb = b.lastCaptureAt ?? '~';
      if (la !== lb) return la.localeCompare(lb);
      return a.team.name.localeCompare(b.team.name, 'da');
    });
}

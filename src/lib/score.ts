import { GRACE_MS, phaseEndMs } from './phase';
import type { Capture, Pellet, Settings, Team } from './types';

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

export interface TeamScore {
  team: Team;
  points: number;
  pellets: Pellet[];
  lastCaptureAt: string | null;
}

export function scoreTeam(
  team: Team,
  captures: readonly Capture[],
  pellets: readonly Pellet[],
  settings: Pick<Settings, 'phaseMinutes'>,
): TeamScore {
  if (!team.startedAt) return { team, points: 0, pellets: [], lastCaptureAt: null };
  const startMs = Date.parse(team.startedAt);
  const endMs = phaseEndMs(team.startedAt, settings.phaseMinutes) + GRACE_MS;
  const byId = new Map(pellets.map(p => [p._id, p]));

  const counted = dedupeCaptures(captures.filter(c => c.teamId === team._id))
    .filter(c => {
      const t = Date.parse(c.capturedAt);
      return t >= startMs && t <= endMs && byId.has(c.pelletId);
    })
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  const eaten = counted.map(c => byId.get(c.pelletId)!);
  return {
    team,
    points: eaten.reduce((sum, p) => sum + p.points, 0),
    pellets: eaten,
    lastCaptureAt: counted.at(-1)?.capturedAt ?? null,
  };
}

/** Points descending; ties go to the team that reached its total first. */
export function rankTeams(
  teams: readonly Team[],
  captures: readonly Capture[],
  pellets: readonly Pellet[],
  settings: Pick<Settings, 'phaseMinutes'>,
): TeamScore[] {
  return teams
    .map(team => scoreTeam(team, captures, pellets, settings))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const la = a.lastCaptureAt ?? '~';
      const lb = b.lastCaptureAt ?? '~';
      if (la !== lb) return la.localeCompare(lb);
      return a.team.name.localeCompare(b.team.name, 'da');
    });
}

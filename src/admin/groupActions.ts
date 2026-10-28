import { api } from '../lib/api';
import type { Settings, Team } from '../lib/types';

async function freshSettings(gameId: string): Promise<Settings> {
  const current = (await api.settings.list({ gameId }))[0];
  if (!current) throw new Error('Settings missing');
  return current;
}

/** The one signal that starts every team. A second press (another tab, a double click) keeps the first start. */
export async function startGroup(gameId: string): Promise<Settings> {
  const current = await freshSettings(gameId);
  if (current.groupStartedAt) return current;
  return api.settings.update({ ...current, groupStartedAt: new Date().toISOString() });
}

/** Back to before the start: every capture, event and heartbeat gone, every team unstarted, no group signal. All read fresh from the store. */
export async function resetGame(gameId: string): Promise<{ settings: Settings; teams: Team[] }> {
  const [captures, events, beats, teams, current] = await Promise.all([
    api.captures.list({ gameId }),
    api.events.list({ gameId }),
    api.heartbeats.list({ gameId }).catch(() => []),
    api.teams.list({ gameId }),
    freshSettings(gameId),
  ]);
  await Promise.all([
    ...captures.map(c => api.captures.remove(c._id)),
    ...events.map(e => api.events.remove(e._id)),
    ...beats.map(b => api.heartbeats.remove(b._id)),
  ]);
  // cruttelut answers 404 to a PUT that changes nothing, so write only what differs.
  const [savedTeams, settings] = await Promise.all([
    Promise.all(teams.map(t => (t.startedAt || t.returnedAt ? api.teams.update({ ...t, startedAt: null, returnedAt: null }) : t))),
    current.groupStartedAt ? api.settings.update({ ...current, groupStartedAt: null }) : current,
  ]);
  return { settings, teams: savedTeams };
}

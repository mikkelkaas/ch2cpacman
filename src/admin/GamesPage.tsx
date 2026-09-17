import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { da } from '../i18n/da';
import { api } from '../lib/api';
import { FIRST_GAME_NAME, homeForOrphans, orphans } from '../lib/games';
import type { Game, Pellet, Team } from '../lib/types';
import HelpButton from './HelpDialog';
import { Button, inputClass, Panel } from './ui';

/**
 * List of games with create and delete. Also the one place that adopts records
 * from before games existed: they join the oldest game, which is created as
 * "Spil 1" if there is none.
 */
export default function GamesPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pellets, setPellets] = useState<Pellet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      let [gameList, settingsList, teamList, pelletList, captureList, eventList] = await Promise.all([
        api.games.list(),
        api.settings.list(),
        api.teams.list(),
        api.pellets.list(),
        api.captures.list(),
        api.events.list(),
      ]);
      const stray = [...orphans(settingsList), ...orphans(teamList), ...orphans(pelletList), ...orphans(captureList), ...orphans(eventList)];
      if (stray.length > 0) {
        let home = homeForOrphans(gameList);
        if (!home) {
          home = await api.games.create({ name: FIRST_GAME_NAME, createdAt: new Date().toISOString() });
          gameList = [home];
        }
        const gameId = home._id;
        await Promise.all([
          ...orphans(settingsList).map(r => api.settings.update({ ...r, gameId })),
          ...orphans(teamList).map(r => api.teams.update({ ...r, gameId })),
          ...orphans(pelletList).map(r => api.pellets.update({ ...r, gameId })),
          ...orphans(captureList).map(r => api.captures.update({ ...r, gameId })),
          ...orphans(eventList).map(r => api.events.update({ ...r, gameId })),
        ]);
        teamList = teamList.map(r => (r.gameId ? r : { ...r, gameId }));
        pelletList = pelletList.map(r => (r.gameId ? r : { ...r, gameId }));
        setNotice(da.migrated(home.name));
      }
      setGames(gameList);
      setTeams(teamList);
      setPellets(pelletList);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const game = await api.games.create({ name: trimmed, createdAt: new Date().toISOString() });
      await api.settings.create({ gameId: game._id, phaseMinutes: 10, start: null });
      setGames(list => [...(list ?? []), game]);
      setName('');
      window.location.hash = `#/admin/${game._id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (game: Game) => {
    if (!confirm(da.confirmDeleteGame(game.name))) return;
    setBusy(true);
    try {
      const [settingsList, teamList, pelletList, captureList, eventList] = await Promise.all([
        api.settings.list(),
        api.teams.list(),
        api.pellets.list(),
        api.captures.list(),
        api.events.list(),
      ]);
      const mine = <T extends { gameId?: string }>(list: T[]) => list.filter(r => r.gameId === game._id);
      await Promise.all([
        ...mine(captureList).map(r => api.captures.remove(r._id)),
        ...mine(eventList).map(r => api.events.remove(r._id)),
        ...mine(pelletList).map(r => api.pellets.remove(r._id)),
        ...mine(teamList).map(r => api.teams.remove(r._id)),
        ...mine(settingsList).map(r => api.settings.remove(r._id)),
      ]);
      await api.games.remove(game._id);
      setGames(list => (list ?? []).filter(g => g._id !== game._id));
      setTeams(list => list.filter(t => t.gameId !== game._id));
      setPellets(list => list.filter(p => p.gameId !== game._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-100 text-gray-900 font-body">
      <header className="flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold">
          Pac-Spejd <span className="text-gray-400 font-normal">{da.admin}</span>
        </h1>
        <div className="flex items-center gap-4">
          <a href="#/" className="text-sm text-blue-700 hover:underline">
            {da.runnerLink}
          </a>
          <HelpButton />
        </div>
      </header>
      <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 bg-red-100 text-red-800 px-4 py-2 text-sm rounded-md">
            <span>{da.fetchFailed}</span>
            <button className="underline" onClick={load}>
              {da.retry}
            </button>
          </div>
        )}
        {notice && <div className="bg-blue-50 text-blue-800 px-4 py-2 text-sm rounded-md">{notice}</div>}
        <Panel title={da.games}>
          {games === null && !error && <p className="text-gray-500 text-sm">{da.loading}</p>}
          {games?.length === 0 && <p className="text-gray-500 text-sm">{da.noGames}</p>}
          {games && games.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {[...games]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map(game => (
                  <li key={game._id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <a href={`#/admin/${game._id}`} className="font-medium text-blue-700 hover:underline">
                        {game.name}
                      </a>
                      <div className="text-xs text-gray-500">
                        {da.gameCounts(teams.filter(t => t.gameId === game._id).length, pellets.filter(p => p.gameId === game._id).length)}
                      </div>
                    </div>
                    <a href={`#/admin/${game._id}`}>
                      <Button variant="primary">{da.openGame}</Button>
                    </a>
                    <Button variant="danger" disabled={busy} onClick={() => void remove(game)}>
                      {da.deleteGame}
                    </Button>
                  </li>
                ))}
            </ul>
          )}
          <form onSubmit={create} className="flex gap-2 pt-2 border-t border-gray-100">
            <input value={name} onChange={e => setName(e.target.value)} placeholder={da.newGameName} className={`${inputClass} flex-1`} />
            <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
              {da.createGame}
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

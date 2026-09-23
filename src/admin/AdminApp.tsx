import { useCallback, useMemo, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { da, formatClock } from '../i18n/da';
import { api } from '../lib/api';
import { rankTeams } from '../lib/score';
import { generateTeamCode } from '../lib/teamCode';
import { deleteFile, PHOTO_BUCKET } from '../lib/files';
import { inGame } from '../lib/games';
import { withDefaults } from '../lib/settings';
import type { Capture, Game, GameEvent, LatLng, Pellet, PelletKind, Settings, Team } from '../lib/types';
import AdminMap from './AdminMap';
import type { MapMode } from './AdminMap';
import PelletsPanel from './PelletsPanel';
import Scoreboard from './Scoreboard';
import SettingsPanel from './SettingsPanel';
import TeamsPanel from './TeamsPanel';
import HelpButton from './HelpDialog';
import { Button } from './ui';

const TEAM_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#0891b2', '#db2777', '#65a30d'];
const POLL_MS = 10_000;
export const DEFAULT_RADIUS_M = 5;

export default function AdminApp({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pellets, setPellets] = useState<Pellet[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  // Codes across every game: a runner's code must identify the game too.
  const [allCodes, setAllCodes] = useState<string[]>([]);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>('idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Point value for the next dots. Set it once, click all the 1-point spots,
  // change it, click all the 2-point spots, and so on. Not persisted.
  const [newPoints, setNewPoints] = useState(1);
  const [newKind, setNewKind] = useState<PelletKind>('normal');
  const now = useNow(1000);

  const loadStatic = useCallback(async () => {
    const [gameList, settingsList, pelletList] = await Promise.all([api.games.list(), api.settings.list(), api.pellets.list()]);
    const found = gameList.find(g => g._id === gameId) ?? null;
    setGame(found);
    if (!found) return;
    let current = inGame(settingsList, gameId)[0];
    if (!current) current = await api.settings.create({ gameId, phaseMinutes: 10, start: null });
    setSettings(current);
    setPellets(inGame(pelletList, gameId));
  }, [gameId]);

  const loadLive = useCallback(async () => {
    // Every team, so new codes stay unique across games; captures and events
    // for this game only, since they grow all day and this runs every poll.
    const [teamList, captureList, eventList] = await Promise.all([api.teams.list(), api.captures.list({ gameId }), api.events.list({ gameId })]);
    setAllCodes(teamList.map(t => t.code));
    setTeams(inGame(teamList, gameId));
    setCaptures(captureList);
    setEvents(eventList);
  }, [gameId]);

  const staticPoll = usePolling(loadStatic, 60 * 60_000);
  const livePoll = usePolling(loadLive, POLL_MS);

  const write = useCallback(async (action: () => Promise<void>) => {
    try {
      await action();
      setWriteError(null);
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const saveSettings = (next: Settings) =>
    write(async () => {
      setSettings(await api.settings.update(next));
    });

  const onMapClick = (latlng: LatLng) => {
    if (!settings || !pellets) return;
    if (mode === 'setStart') {
      setMode('idle');
      void saveSettings({ ...settings, start: latlng });
      return;
    }
    void write(async () => {
      const created = await api.pellets.create({ gameId, name: `Prik ${pellets.length + 1}`, lat: latlng.lat, lng: latlng.lng, radiusM: DEFAULT_RADIUS_M, points: newPoints, kind: newKind });
      setPellets(list => [...(list ?? []), created]);
      setSelectedId(created._id);
    });
  };

  const savePellet = (pellet: Pellet) =>
    write(async () => {
      const saved = await api.pellets.update(pellet);
      setPellets(list => (list ?? []).map(p => (p._id === saved._id ? saved : p)));
    });

  const movePellet = (id: string, latlng: LatLng) => {
    const pellet = pellets?.find(p => p._id === id);
    if (pellet) void savePellet({ ...pellet, lat: latlng.lat, lng: latlng.lng });
  };

  const deletePellet = (pellet: Pellet) =>
    write(async () => {
      await api.pellets.remove(pellet._id);
      setPellets(list => (list ?? []).filter(p => p._id !== pellet._id));
      setSelectedId(id => (id === pellet._id ? null : id));
    });

  const addTeams = (names: string[]) =>
    write(async () => {
      const codes = new Set(allCodes);
      const created: Team[] = [];
      for (const [i, name] of names.entries()) {
        const code = generateTeamCode(codes);
        codes.add(code);
        created.push(
          await api.teams.create({
            gameId,
            name,
            code,
            color: TEAM_COLORS[(teams.length + i) % TEAM_COLORS.length],
            createdAt: new Date().toISOString(),
            startedAt: null,
          }),
        );
      }
      setTeams(list => [...list, ...created]);
      setAllCodes(list => [...list, ...created.map(t => t.code)]);
    });

  // Straight from the store, not the last poll: a phone may have uploaded
  // captures since, and any left behind would stay eaten on the rerun.
  const deleteTeamCaptures = async (team: Team) => {
    const [mine, myEvents, beats] = await Promise.all([
      api.captures.list({ teamId: team._id }),
      api.events.list({ teamId: team._id }),
      api.heartbeats.list({ teamId: team._id }).catch(() => []),
    ]);
    await Promise.all([
      ...mine.map(c => api.captures.remove(c._id)),
      ...myEvents.map(e => api.events.remove(e._id)),
      ...beats.map(b => api.heartbeats.remove(b._id)),
    ]);
    setCaptures(list => list.filter(c => c.teamId !== team._id));
    setEvents(list => list.filter(e => e.teamId !== team._id));
  };

  // PUT replaces the whole record, and the copy here can be a poll old: build
  // every team write on the record as the store has it now.
  const freshTeam = async (team: Team): Promise<Team> => (await api.teams.list({ _id: team._id }))[0] ?? team;

  const resetTeam = (team: Team) =>
    write(async () => {
      await deleteTeamCaptures(team);
      const saved = await api.teams.update({ ...(await freshTeam(team)), startedAt: null, returnedAt: null });
      setTeams(list => list.map(t => (t._id === saved._id ? saved : t)));
    });

  const markHome = (team: Team) =>
    write(async () => {
      const current = await freshTeam(team);
      // The phone may have stamped itself home since the last poll: keep that.
      const saved = current.returnedAt ? current : await api.teams.update({ ...current, returnedAt: new Date().toISOString() });
      setTeams(list => list.map(t => (t._id === saved._id ? saved : t)));
    });

  const deleteTeam = (team: Team) =>
    write(async () => {
      await deleteTeamCaptures(team);
      if (team.photoKey) await deleteFile(PHOTO_BUCKET, team.photoKey).catch(() => undefined);
      await api.teams.remove(team._id);
      setTeams(list => list.filter(t => t._id !== team._id));
    });

  // `now` is a dependency: a team still out after the end loses points as the clock runs.
  const scores = useMemo(
    () => (settings && pellets ? rankTeams(teams, captures, pellets, settings, events, now) : []),
    [teams, captures, pellets, settings, events, now],
  );

  const shell = (children: React.ReactNode) => <div className="min-h-full bg-gray-100 text-gray-900 font-body">{children}</div>;

  if (game === null) {
    return shell(
      <div className="p-8 text-center text-gray-600">
        <p className="mb-3">{da.gameNotFound}</p>
        <a href="#/admin" className="text-blue-700 underline">
          {da.allGames}
        </a>
      </div>,
    );
  }

  if (!settings || !pellets || !game) {
    return shell(
      <div className="p-8 text-center text-gray-600">
        {staticPoll.error ? (
          <>
            <p className="text-red-700 mb-3">{da.fetchFailed}</p>
            <Button onClick={staticPoll.reload}>{da.retry}</Button>
          </>
        ) : (
          <p>{da.loading}</p>
        )}
      </div>,
    );
  }

  const error = writeError ? da.saveFailed : livePoll.error || staticPoll.error ? da.fetchFailed : null;

  return shell(
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold flex items-center gap-2 min-w-0">
          <a href="#/admin" className="text-gray-400 font-normal hover:underline shrink-0">
            {da.allGames}
          </a>
          <span className="text-gray-300">/</span>
          <span className="truncate">{game.name}</span>
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {livePoll.lastLoadedAt && <span>{da.refreshed(formatClock(livePoll.lastLoadedAt))}</span>}
          <a href="#/" className="text-blue-700 hover:underline">
            {da.runnerLink}
          </a>
          <a href={`#/admin/${gameId}/print`} className="text-blue-700 hover:underline">
            {da.print}
          </a>
          <HelpButton />
        </div>
      </header>
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 bg-red-100 text-red-800 px-4 py-2 text-sm border-b border-red-200">
          <span>{error}</span>
          <button
            className="underline"
            onClick={() => {
              setWriteError(null);
              void staticPoll.reload();
              void livePoll.reload();
            }}
          >
            {da.retry}
          </button>
        </div>
      )}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_460px]">
        <div className="h-[50vh] lg:h-[calc(100vh-3.5rem)] lg:sticky lg:top-0 border-b lg:border-b-0 lg:border-r border-gray-200">
          <AdminMap pellets={pellets} start={settings.start} selectedId={selectedId} mode={mode} onMapClick={onMapClick} onSelect={setSelectedId} onMovePellet={movePellet} />
        </div>
        <div className="flex flex-col gap-4 p-4">
          <Scoreboard scores={scores} />
          <TeamsPanel teams={teams} settings={withDefaults(settings)} now={now} onAdd={addTeams} onReset={resetTeam} onMarkHome={markHome} onDelete={deleteTeam} />
          <SettingsPanel settings={settings} mode={mode} onSave={saveSettings} onSetMode={setMode} />
          <PelletsPanel pellets={pellets} start={settings.start} selectedId={selectedId} newPoints={newPoints} onNewPointsChange={setNewPoints} newKind={newKind} onNewKindChange={setNewKind} onSelect={setSelectedId} onSave={savePellet} onDelete={deletePellet} />
        </div>
      </div>
    </div>,
  );
}

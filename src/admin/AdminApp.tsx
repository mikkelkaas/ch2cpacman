import { useCallback, useMemo, useState } from 'react';
import ArcadeTitle from '../components/ArcadeTitle';
import ErrorBar from '../components/ErrorBar';
import FullScreenMessage from '../components/FullScreenMessage';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { da, formatClock } from '../i18n/da';
import { api } from '../lib/api';
import { rankTeams } from '../lib/score';
import { generateTeamCode } from '../lib/teamCode';
import type { Capture, LatLng, Pellet, Settings, Team } from '../lib/types';
import AdminMap from './AdminMap';
import type { MapMode } from './AdminMap';
import PelletsPanel from './PelletsPanel';
import Scoreboard from './Scoreboard';
import SettingsPanel from './SettingsPanel';
import TeamsPanel from './TeamsPanel';

const GHOST_COLORS = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852', '#ffe600', '#2121ff', '#ffb8ae', '#00ff00'];
const POLL_MS = 10_000;

export default function AdminApp() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pellets, setPellets] = useState<Pellet[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>('idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const now = useNow(1000);

  const loadStatic = useCallback(async () => {
    const [settingsList, pelletList] = await Promise.all([api.settings.list(), api.pellets.list()]);
    let current = settingsList[0];
    if (!current) current = await api.settings.create({ phaseMinutes: 10, start: null });
    setSettings(current);
    setPellets(pelletList);
  }, []);

  const loadLive = useCallback(async () => {
    const [teamList, captureList] = await Promise.all([api.teams.list(), api.captures.list()]);
    setTeams(teamList);
    setCaptures(captureList);
  }, []);

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
    } else if (mode === 'addPellet') {
      setMode('idle');
      void write(async () => {
        const created = await api.pellets.create({ name: `Prik ${pellets.length + 1}`, lat: latlng.lat, lng: latlng.lng, radiusM: 25, points: 1 });
        setPellets(list => [...(list ?? []), created]);
        setSelectedId(created._id);
      });
    }
  };

  const savePellet = (pellet: Pellet) =>
    write(async () => {
      const saved = await api.pellets.update(pellet);
      setPellets(list => (list ?? []).map(p => (p._id === saved._id ? saved : p)));
    });

  const deletePellet = (pellet: Pellet) =>
    write(async () => {
      await api.pellets.remove(pellet._id);
      setPellets(list => (list ?? []).filter(p => p._id !== pellet._id));
      setSelectedId(id => (id === pellet._id ? null : id));
    });

  const addTeam = (name: string) =>
    write(async () => {
      const created = await api.teams.create({
        name,
        code: generateTeamCode(teams.map(t => t.code)),
        color: GHOST_COLORS[teams.length % GHOST_COLORS.length],
        createdAt: new Date().toISOString(),
        startedAt: null,
      });
      setTeams(list => [...list, created]);
    });

  const deleteTeamCaptures = async (team: Team) => {
    const mine = captures.filter(c => c.teamId === team._id);
    await Promise.all(mine.map(c => api.captures.remove(c._id)));
    setCaptures(list => list.filter(c => c.teamId !== team._id));
  };

  const resetTeam = (team: Team) =>
    write(async () => {
      await deleteTeamCaptures(team);
      const saved = await api.teams.update({ ...team, startedAt: null });
      setTeams(list => list.map(t => (t._id === saved._id ? saved : t)));
    });

  const deleteTeam = (team: Team) =>
    write(async () => {
      await deleteTeamCaptures(team);
      await api.teams.remove(team._id);
      setTeams(list => list.filter(t => t._id !== team._id));
    });

  const scores = useMemo(
    () => (settings && pellets ? rankTeams(teams, captures, pellets, settings) : []),
    [teams, captures, pellets, settings],
  );

  if (!settings || !pellets) {
    return staticPoll.error ? (
      <div className="min-h-full flex flex-col">
        <ErrorBar message={da.fetchFailed} onRetry={staticPoll.reload} />
        <FullScreenMessage title={da.admin} />
      </div>
    ) : (
      <FullScreenMessage title={da.loading} />
    );
  }

  const error = writeError ? da.saveFailed : livePoll.error || staticPoll.error ? da.fetchFailed : null;

  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b-4 border-maze">
        <ArcadeTitle size="sm">
          {da.title} <span className="text-pellet">{da.admin}</span>
        </ArcadeTitle>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {livePoll.lastLoadedAt && <span>{da.refreshed(formatClock(livePoll.lastLoadedAt))}</span>}
          <a href="#/" className="underline text-pac">
            {da.runnerLink}
          </a>
        </div>
      </header>
      {error && <ErrorBar message={error} onRetry={() => { setWriteError(null); void staticPoll.reload(); void livePoll.reload(); }} />}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_440px]">
        <div className="h-[50vh] lg:h-[calc(100vh-4rem)] lg:sticky lg:top-0 border-b-4 lg:border-b-0 lg:border-r-4 border-maze">
          <AdminMap pellets={pellets} start={settings.start} selectedId={selectedId} mode={mode} onMapClick={onMapClick} onSelect={setSelectedId} />
        </div>
        <div className="flex flex-col gap-4 p-4">
          <Scoreboard scores={scores} />
          <TeamsPanel teams={teams} phaseMinutes={settings.phaseMinutes} now={now} onAdd={addTeam} onReset={resetTeam} onDelete={deleteTeam} />
          <SettingsPanel settings={settings} mode={mode} onSave={saveSettings} onSetMode={setMode} />
          <PelletsPanel pellets={pellets} start={settings.start} selectedId={selectedId} mode={mode} onSelect={setSelectedId} onSetMode={setMode} onSave={savePellet} onDelete={deletePellet} />
        </div>
      </div>
    </div>
  );
}

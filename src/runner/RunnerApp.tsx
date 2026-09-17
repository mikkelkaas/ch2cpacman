import { useCallback, useEffect, useMemo, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton';
import ArcadeTitle from '../components/ArcadeTitle';
import ErrorBar from '../components/ErrorBar';
import FullScreenMessage from '../components/FullScreenMessage';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNow } from '../hooks/useNow';
import { useWakeLock } from '../hooks/useWakeLock';
import { da } from '../i18n/da';
import { api } from '../lib/api';
import { phaseState, remainingMs } from '../lib/phase';
import { pending } from '../lib/queue';
import { dedupeCaptures } from '../lib/score';
import { sound } from '../lib/sound';
import { storage } from '../lib/storage';
import type { Capture, Pellet, Settings, Team } from '../lib/types';
import Briefing from './Briefing';
import CodeScreen from './CodeScreen';
import GameOver from './GameOver';
import Hud from './Hud';
import RunnerMap from './RunnerMap';
import { useCaptureEngine } from './useCaptureEngine';

interface Loaded {
  settings: Settings | null;
  pellets: Pellet[];
  teams: Team[];
}

export default function RunnerApp() {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState(() => storage.getTeamId());
  const [captures, setCaptures] = useState<Capture[] | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [settingsList, pellets, teams] = await Promise.all([api.settings.list(), api.pellets.list(), api.teams.list()]);
      setData({ settings: settingsList[0] ?? null, pellets, teams });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // This team's captures, once, so a reload never resurrects eaten pellets.
  useEffect(() => {
    if (!teamId) {
      setCaptures(null);
      return;
    }
    let cancelled = false;
    api.captures
      .list()
      .then(all => {
        if (!cancelled) setCaptures(all.filter(c => c.teamId === teamId));
      })
      .catch(() => {
        if (!cancelled) setCaptures([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loadError && !data) {
    return (
      <div className="min-h-full flex flex-col">
        <ErrorBar message={da.fetchFailed} onRetry={load} />
        <FullScreenMessage title={da.title} />
      </div>
    );
  }
  if (!data) return <FullScreenMessage title={da.loading} />;

  const { settings, pellets, teams } = data;
  if (!settings || !settings.start || pellets.length === 0) {
    return <FullScreenMessage title={da.notSetUp}>{da.notSetUpHint}</FullScreenMessage>;
  }

  const team = teams.find(t => t._id === teamId) ?? null;
  if (!team) {
    return (
      <CodeScreen
        teams={teams}
        onJoin={t => {
          storage.setTeamId(t._id);
          setTeamId(t._id);
        }}
      />
    );
  }
  if (!captures) return <FullScreenMessage title={da.loading} />;

  return (
    <Game
      key={team._id}
      team={team}
      settings={settings}
      pellets={pellets}
      captures={captures}
      onTeamChange={updated => setData(d => (d ? { ...d, teams: d.teams.map(t => (t._id === updated._id ? updated : t)) } : d))}
      onLeaveTeam={() => {
        storage.setTeamId(null);
        setTeamId(null);
      }}
    />
  );
}

interface GameProps {
  team: Team;
  settings: Settings;
  pellets: Pellet[];
  captures: Capture[];
  onTeamChange: (team: Team) => void;
  onLeaveTeam: () => void;
}

function Game({ team, settings, pellets, captures, onTeamChange, onLeaveTeam }: GameProps) {
  const now = useNow(250);
  const state = phaseState(team, settings.phaseMinutes, now);
  const [briefed, setBriefed] = useState(state !== 'idle');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [readyFlash, setReadyFlash] = useState(false);
  const { fix, error: geoError } = useGeolocation();
  useWakeLock(state !== 'over');

  const initialEatenIds = useMemo(() => {
    const ids = new Set(dedupeCaptures(captures).map(c => c.pelletId));
    for (const q of pending()) if (q.teamId === team._id) ids.add(q.pelletId);
    return ids;
  }, [captures, team._id]);

  const engine = useCaptureEngine({ active: state === 'running', fix, pellets, team, initialEatenIds });

  const start = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const updated = await api.teams.update({ ...team, startedAt: new Date().toISOString() });
      sound.unlock();
      sound.startJingle();
      setReadyFlash(true);
      window.setTimeout(() => setReadyFlash(false), 1500);
      onTeamChange(updated);
    } catch {
      setStartError(da.startFailed);
    } finally {
      setStarting(false);
    }
  };

  if (geoError === 'denied' || geoError === 'unavailable') {
    return <FullScreenMessage title={da.locationDenied}>{da.locationDeniedHint}</FullScreenMessage>;
  }

  if (state === 'idle' && !briefed) {
    return <Briefing teamName={team.name} phaseMinutes={settings.phaseMinutes} onDone={() => setBriefed(true)} />;
  }

  const eatenCount = pellets.filter(p => engine.eatenIds.has(p._id)).length;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <RunnerMap pellets={pellets} eatenIds={engine.eatenIds} start={settings.start} fix={fix} dimmed={state === 'over'} />

      {state === 'idle' && (
        <div className="absolute inset-x-0 bottom-0 z-[450] p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center gap-3">
          <div className="font-arcade text-[10px] text-pellet">{team.name}</div>
          <p className="text-gray-200 text-center">{fix ? da.readyQuestion : da.locationWaiting}</p>
          {startError && <p className="font-arcade text-ghost-red text-xs">{startError}</p>}
          <ArcadeButton onClick={start} disabled={starting || !fix} className="w-full max-w-sm text-lg py-5 glow-maze">
            {starting ? da.starting : da.pressStart}
          </ArcadeButton>
          <div className="flex gap-4 text-xs text-gray-500">
            <button onClick={() => setRulesOpen(true)} className="underline">
              {da.showRules}
            </button>
            <button onClick={onLeaveTeam} className="underline">
              {da.changeTeam}
            </button>
          </div>
        </div>
      )}

      {state === 'running' && (
        <Hud
          remainingMs={remainingMs(team.startedAt!, settings.phaseMinutes, now)}
          points={engine.points}
          pendingCount={engine.pendingCount}
          onShowRules={() => setRulesOpen(true)}
        />
      )}

      {readyFlash && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center pointer-events-none">
          <ArcadeTitle size="xl" className="blink">
            {da.ready}
          </ArcadeTitle>
        </div>
      )}

      {state === 'over' && <GameOver points={engine.points} pelletCount={eatenCount} teamName={team.name} />}

      {rulesOpen && <Briefing overlay teamName={team.name} phaseMinutes={settings.phaseMinutes} onDone={() => setRulesOpen(false)} />}
    </div>
  );
}

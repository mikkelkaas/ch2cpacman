import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton';
import ArcadeTitle from '../components/ArcadeTitle';
import ErrorBar from '../components/ErrorBar';
import FullScreenMessage from '../components/FullScreenMessage';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNow } from '../hooks/useNow';
import { useWakeLock } from '../hooks/useWakeLock';
import { da } from '../i18n/da';
import { api } from '../lib/api';
import { haversineM } from '../lib/geo';
import { latePenalty } from '../lib/late';
import { lateMs, phaseState, remainingMs } from '../lib/phase';
import { pending } from '../lib/queue';
import { isUsableFix } from '../lib/fix';
import { isFrightened } from '../lib/ghosts';
import { dedupeCaptures, doubleRemainingMs } from '../lib/score';
import { GHOST_WARN_M, withDefaults } from '../lib/settings';
import { sound } from '../lib/sound';
import { photoUrl } from '../lib/files';
import { setJoinHash } from '../lib/route';
import type { Role } from '../lib/route';
import { storage } from '../lib/storage';
import type { Capture, GameEvent, GameSettings, Pellet, Settings, Team } from '../lib/types';
import Briefing from './Briefing';
import CodeScreen from './CodeScreen';
import GameOver from './GameOver';
import Hud from './Hud';
import PhotoScreen from './PhotoScreen';
import RunnerMap from './RunnerMap';
import { useCaptureEngine } from './useCaptureEngine';
import { useGhosts } from './useGhosts';
import { useReturnHome } from './useReturnHome';

interface GameData {
  settings: Settings;
  pellets: Pellet[];
  captures: Capture[];
  events: GameEvent[];
}

export default function RunnerApp({ joinCode = null, joinRole = 'runner' }: { joinCode?: string | null; joinRole?: Role }) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState(() => storage.getTeamId());
  const [role, setRole] = useState<Role>(() => storage.getRole());
  const [data, setData] = useState<GameData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  // Teams first: the code on the phone identifies both the team and its game.
  const loadTeams = useCallback(async () => {
    setLoadError(null);
    try {
      setTeams(await api.teams.list());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const chooseTeam = useCallback((t: Team | null, r: Role = 'runner') => {
    storage.setTeamId(t?._id ?? null);
    storage.setRole(t ? r : null);
    setTeamId(t?._id ?? null);
    setRole(t ? r : 'runner');
  }, []);

  // A scanned QR or a reload carries the code and role in the address: join
  // without typing. Consumed once per code, so a team change made later on
  // the code screen is not undone when the team list refreshes.
  const consumedJoinCode = useRef<string | null>(null);
  useEffect(() => {
    if (!joinCode || !teams || consumedJoinCode.current === joinCode) return;
    consumedJoinCode.current = joinCode;
    // No such team (a stale link, a typo in the address): the stored team
    // stands, and the address is corrected below.
    const match = teams.find(t => t.code === joinCode);
    if (match) chooseTeam(match, joinRole);
  }, [joinCode, joinRole, teams, chooseTeam]);

  const team = teams?.find(t => t._id === teamId) ?? null;

  // The address follows the joined team and role, whether they came from the
  // QR, the code screen or localStorage: a reload, or the tab reopened from
  // history, rejoins from the address even when storage is blocked or
  // cleared. Not before the team list is in, so a failed load keeps the
  // scanned address. Also after a code was typed into the address and
  // matched no team.
  useEffect(() => {
    if (!teams) return;
    setJoinHash(team?.code ?? null, role);
  }, [teams, team?.code, role, joinCode]);

  const gameId = team?.gameId ?? null;
  // Keyed on ids, not the team object: a team update (start, photo) must not
  // reload the game and remount the screens.
  const loadTeamId = team?._id ?? null;

  // Then the team's game: settings, pellets, and this team's captures and
  // events once, so a reload never resurrects eaten pellets or lost points.
  // Captures and events grow all day, so the server filters them by team.
  const loadGame = useCallback(async () => {
    if (!loadTeamId) return;
    setDataError(null);
    try {
      const [settingsList, pelletList, captures, events] = await Promise.all([
        api.settings.list(),
        api.pellets.list(),
        api.captures.list({ teamId: loadTeamId }),
        api.events.list({ teamId: loadTeamId }).catch(() => [] as GameEvent[]),
      ]);
      const forGame = <T extends { gameId?: string }>(list: T[]) => (gameId ? list.filter(r => r.gameId === gameId) : list.filter(r => !r.gameId));
      const settings = forGame(settingsList)[0] ?? null;
      setData({
        settings: settings ?? { _id: '', phaseMinutes: 10, start: null },
        pellets: forGame(pelletList),
        captures,
        events,
      });
    } catch (err) {
      setDataError(err instanceof Error ? err.message : String(err));
    }
  }, [loadTeamId, gameId]);

  useEffect(() => {
    setData(null);
    void loadGame();
  }, [loadGame]);

  if (loadError && !teams) {
    return (
      <div className="min-h-full flex flex-col">
        <ErrorBar message={da.fetchFailed} onRetry={loadTeams} />
        <FullScreenMessage title={da.title} />
      </div>
    );
  }
  if (!teams) return <FullScreenMessage title={da.loading} />;

  if (!team) {
    return (
      <CodeScreen
        teams={teams}
        onJoin={chooseTeam}
      />
    );
  }

  if (dataError && !data) {
    return (
      <div className="min-h-full flex flex-col">
        <ErrorBar message={da.fetchFailed} onRetry={loadGame} />
        <FullScreenMessage title={da.title} />
      </div>
    );
  }
  if (!data) return <FullScreenMessage title={da.loading} />;

  const { settings, pellets, captures, events } = data;
  if (!settings._id || !settings.start || pellets.length === 0) {
    return (
      <FullScreenMessage title={da.notSetUp}>
        {da.notSetUpHint}
        <div className="mt-4">
          <button
            className="underline text-gray-500 text-sm"
            onClick={() => chooseTeam(null)}
          >
            {da.changeTeam}
          </button>
        </div>
      </FullScreenMessage>
    );
  }

  return (
    <Game
      key={team._id}
      team={team}
      settings={withDefaults(settings)}
      pellets={pellets}
      captures={captures}
      events={events}
      onTeamChange={updated => setTeams(list => (list ? list.map(t => (t._id === updated._id ? updated : t)) : list))}
      onLeaveTeam={() => chooseTeam(null)}
    />
  );
}

interface GameProps {
  team: Team;
  settings: GameSettings;
  pellets: Pellet[];
  captures: Capture[];
  events: GameEvent[];
  onTeamChange: (team: Team) => void;
  onLeaveTeam: () => void;
}

function Game({ team, settings, pellets, captures, events, onTeamChange, onLeaveTeam }: GameProps) {
  const now = useNow(250);
  const { fix, error: geoError } = useGeolocation();
  const rule = { lateStepS: settings.lateStepS, latePenaltyPerStep: settings.latePenaltyPerStep, latePenaltyMax: settings.latePenaltyMax };
  // The countdown has ended and the team is not home: keep looking for home.
  const afterEnd = !!team.startedAt && phaseState(team, settings.phaseMinutes, now, rule) === 'late';
  const { homeAt } = useReturnHome({ active: afterEnd, fix, team, settings, onTeamChange });
  // The phone's own stamp counts before the upload lands, like queued captures.
  const returnedAt = team.returnedAt ?? homeAt;
  const state = phaseState({ startedAt: team.startedAt, returnedAt }, settings.phaseMinutes, now, rule);
  const [briefed, setBriefed] = useState(state !== 'idle');
  const [photoSkipped, setPhotoSkipped] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [readyFlash, setReadyFlash] = useState(false);
  useWakeLock(state !== 'over');

  const initialEatenIds = useMemo(() => {
    const ids = new Set(dedupeCaptures(captures).map(c => c.pelletId));
    for (const q of pending()) if (q.teamId === team._id) ids.add(q.pelletId);
    return ids;
  }, [captures, team._id]);

  const ghosts = useGhosts({ active: state === 'running', fix, pellets, team, settings, initialEvents: events });
  const engine = useCaptureEngine({
    active: state === 'running',
    fix,
    pellets,
    team,
    settings,
    initialEatenIds,
    initialCaptures: captures,
    onEaten: pellet => {
      if (pellet.kind === 'power') ghosts.powerEaten();
    },
  });
  const late = team.startedAt ? latePenalty(team.startedAt, { ...rule, phaseMinutes: settings.phaseMinutes }, returnedAt, now) : 0;
  const points = Math.max(0, engine.points + ghosts.eventPoints - late);
  const homeDistanceM = fix && settings.start ? Math.round(haversineM(fix, settings.start)) : null;

  // Cues for the run home: a siren when the countdown ends away from home,
  // a blip each time the penalty grows.
  useEffect(() => {
    if (state === 'late') sound.siren();
  }, [state]);
  useEffect(() => {
    if (state === 'late' && late > 0) sound.blip();
  }, [state, late]);
  const frightened = ghosts.ghosts ? isFrightened(ghosts.ghosts, now) : false;
  const ghostMode = !frightened ? 'normal' : ghosts.ghosts!.frightenedUntilMs - now < 5000 ? 'flashing' : 'frightened';
  const shielded = (ghosts.ghosts?.immuneUntilMs ?? 0) > now;
  const doubleMs = doubleRemainingMs(engine.captureTimes, pellets, settings.doubleSeconds, now);

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
    return <Briefing teamName={team.name} settings={settings} pellets={pellets} onDone={() => setBriefed(true)} />;
  }
  if (state === 'idle' && !team.photoKey && !photoSkipped) {
    return <PhotoScreen team={team} onDone={onTeamChange} onSkip={() => setPhotoSkipped(true)} />;
  }

  const eatenCount = pellets.filter(p => engine.eatenIds.has(p._id)).length;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <RunnerMap
        theme={settings.mapTheme}
        pellets={pellets}
        eatenIds={engine.eatenIds}
        start={settings.start}
        fix={fix}
        ghosts={state === 'running' ? ghosts.ghosts?.ghosts : []}
        ghostMode={ghostMode}
        shielded={state === 'running' && shielded}
        dimmed={state === 'over'}
        homeRadiusM={state === 'late' ? settings.homeRadiusM : null}
      />

      {state === 'idle' && (
        <div className="absolute inset-x-0 bottom-0 z-[450] p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            {team.photoKey && <img src={photoUrl(team.photoKey)} alt="" className="w-12 h-12 object-cover border-2 border-maze" />}
            <div className="font-arcade text-[10px] text-pellet">{team.name}</div>
          </div>
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

      {(state === 'running' || state === 'late') && (
        <Hud
          remainingMs={remainingMs(team.startedAt!, settings.phaseMinutes, now)}
          lateMs={state === 'late' ? lateMs(team.startedAt!, settings.phaseMinutes, now) : 0}
          latePoints={late}
          homeDistanceM={homeDistanceM}
          points={points}
          pendingCount={engine.pendingCount}
          onShowRules={() => setRulesOpen(true)}
          doubleMs={doubleMs}
          danger={state === 'late' || ghosts.nearest < GHOST_WARN_M}
          power={frightened}
          ghostBanner={ghosts.banner}
          weakSignal={!!fix && !isUsableFix(fix)}
        />
      )}

      {readyFlash && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center pointer-events-none">
          <ArcadeTitle size="xl" className="blink">
            {da.ready}
          </ArcadeTitle>
        </div>
      )}

      {state === 'over' && (
        <GameOver
          points={points}
          pelletCount={eatenCount}
          teamName={team.name}
          photoUrl={team.photoKey ? photoUrl(team.photoKey) : null}
          late={late}
          homeInTime={rule.latePenaltyPerStep > 0 && !!returnedAt && late === 0}
        />
      )}

      {rulesOpen && <Briefing overlay teamName={team.name} settings={settings} pellets={pellets} onDone={() => setRulesOpen(false)} />}
    </div>
  );
}

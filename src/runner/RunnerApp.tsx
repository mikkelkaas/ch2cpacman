import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton';
import ArcadeTitle from '../components/ArcadeTitle';
import ErrorBar from '../components/ErrorBar';
import FullScreenMessage from '../components/FullScreenMessage';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNow } from '../hooks/useNow';
import { useWakeLock } from '../hooks/useWakeLock';
import { useT } from '../i18n/LangProvider';
import { api } from '../lib/api';
import { haversineM } from '../lib/geo';
import { groupEndMs, isGroupMode, isSharedDots, settingsChange, signalPendingMs, withGroupStart } from '../lib/group';
import { isHome, latePenalty } from '../lib/late';
import { lateMs, phaseState, remainingMs } from '../lib/phase';
import { eventQueue, pending } from '../lib/queue';
import { isUsableFix } from '../lib/fix';
import { isFrightened } from '../lib/ghosts';
import { restoredGhosts } from '../lib/heartbeat';
import type { Heartbeat } from '../lib/heartbeat';
import { doubleRemainingMs, ofCurrentRun } from '../lib/score';
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
import SpectatorGame from './SpectatorGame';
import SpectatorQr from './SpectatorQr';
import { initialCaptureTimes, useCaptureEngine } from './useCaptureEngine';
import { useGhosts } from './useGhosts';
import { fetchGameSettings, STARTED_POLL_MS, useGroupSignal, WAITING_POLL_MS } from './useGroupSignal';
import { useHeartbeat } from './useHeartbeat';
import { useReturnHome } from './useReturnHome';
import { useLostDotBanner, useSharedDots } from './useSharedDots';

interface GameData {
  settings: Settings;
  pellets: Pellet[];
  captures: Capture[];
  events: GameEvent[];
  /** This team's last heartbeat, so a reload continues the ghosts. */
  heartbeat: Heartbeat | null;
  /** Which load this is: a new one remounts the game, fresh. */
  load: number;
  /** Reloaded because the leader cleared or replaced the signal: the team has read the rules. */
  resumed: boolean;
}

export default function RunnerApp({ joinCode = null, joinRole = 'runner' }: { joinCode?: string | null; joinRole?: Role }) {
  const t = useT();
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
  // without typing. Consumed once per code and role, so a team change made
  // later on the code screen is not undone when the team list refreshes, but
  // navigating to a different role on the same code (join -> watch) still
  // takes effect.
  const consumedJoin = useRef<string | null>(null);
  useEffect(() => {
    if (!joinCode || !teams) return;
    const key = `${joinCode}:${joinRole}`;
    if (consumedJoin.current === key) return;
    consumedJoin.current = key;
    // No such team (a stale link, a typo in the address): the stored team
    // stands, and the address is corrected below.
    const match = teams.find(t => t.code === joinCode);
    if (match) chooseTeam(match, joinRole);
  }, [joinCode, joinRole, teams, chooseTeam]);

  // The raw record, as the store has it. Every team write is built on this.
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
  // The team (and so the game) can change while a load is in flight: a QR
  // opened on a phone that remembers another team starts loading the old
  // team's game first. Only the latest load may set the data.
  const loadSeq = useRef(0);
  const loadGame = useCallback(async (resumed = false) => {
    if (!loadTeamId) return;
    const seq = ++loadSeq.current;
    setDataError(null);
    try {
      // Only this game's settings and dots. Records from before games existed
      // have no gameId to filter on, so that case still reads them all.
      const byGame = gameId ? { gameId } : undefined;
      const [settingsList, pelletList, captures, events, beats] = await Promise.all([
        api.settings.list(byGame),
        api.pellets.list(byGame),
        api.captures.list({ teamId: loadTeamId }),
        api.events.list({ teamId: loadTeamId }).catch(() => [] as GameEvent[]),
        api.heartbeats.list({ teamId: loadTeamId }).catch(() => [] as Heartbeat[]),
      ]);
      const forGame = <T extends { gameId?: string }>(list: T[]) => (gameId ? list.filter(r => r.gameId === gameId) : list.filter(r => !r.gameId));
      const settings = forGame(settingsList)[0] ?? null;
      if (seq !== loadSeq.current) return;
      setData({
        settings: settings ?? { _id: '', phaseMinutes: 10, start: null },
        pellets: forGame(pelletList),
        captures,
        events,
        heartbeat: beats[0] ?? null,
        load: seq,
        resumed,
      });
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setDataError(err instanceof Error ? err.message : String(err));
    }
  }, [loadTeamId, gameId]);

  useEffect(() => {
    setData(null);
    void loadGame();
    // Leaving the team also cancels its load.
    return () => {
      loadSeq.current++;
    };
  }, [loadGame]);

  // The leader's signal, a Spilform change, a Nulstil alle or a second Start
  // alle land on the settings record while the game is open. A cleared or
  // replaced signal ends the run on screen: reload the game (the eaten dots
  // and ghosts of the old run are gone from the store) and start it over.
  const openSettings = useRef<Settings | null>(null);
  openSettings.current = data?.settings ?? null;
  const restarting = useRef(false);
  const onSettingsChange = useCallback(
    (fresh: Settings) => {
      const open = openSettings.current;
      if (!open) return;
      const change = settingsChange(open, fresh);
      if (change === 'update') setData(d => (d ? { ...d, settings: fresh } : d));
      // A failed reload leaves the old settings open, so the next read tries again.
      if (change === 'restart' && !restarting.current) {
        restarting.current = true;
        void loadGame(true).finally(() => {
          restarting.current = false;
        });
      }
    },
    [loadGame],
  );

  // The team as the game sees it: in a group game it starts on the signal.
  // Only for display and play, never written back.
  const loadedSettings = data?.settings ?? null;
  const effectiveTeam = useMemo(() => (team && loadedSettings ? withGroupStart(team, loadedSettings) : team), [team, loadedSettings]);

  if (loadError && !teams) {
    return (
      <div className="min-h-full flex flex-col">
        <ErrorBar message={t.fetchFailed} onRetry={loadTeams} />
        <FullScreenMessage title={t.title} />
      </div>
    );
  }
  if (!teams) return <FullScreenMessage title={t.loading} />;

  if (!team) {
    return <CodeScreen teams={teams} initialRole={joinRole} onJoin={chooseTeam} />;
  }

  if (dataError && !data) {
    return (
      <div className="min-h-full flex flex-col">
        <ErrorBar message={t.fetchFailed} onRetry={() => void loadGame()} />
        <FullScreenMessage title={t.title} />
      </div>
    );
  }
  if (!data) return <FullScreenMessage title={t.loading} />;

  const { settings, pellets, captures, events, heartbeat, load, resumed } = data;
  if (!settings._id || !settings.start || pellets.length === 0) {
    return (
      <FullScreenMessage title={t.notSetUp}>
        {t.notSetUpHint}
        <div className="mt-4">
          <button
            className="underline text-gray-500 text-sm"
            onClick={() => chooseTeam(null)}
          >
            {t.changeTeam}
          </button>
        </div>
      </FullScreenMessage>
    );
  }

  if (role === 'spectator') {
    return (
      <SpectatorGame
        key={`watch-${team._id}`}
        team={team}
        settings={withDefaults(settings)}
        pellets={pellets}
        captures={captures}
        events={events}
        onLeaveTeam={() => chooseTeam(null)}
      />
    );
  }

  return (
    <Game
      key={`${team._id}:${load}`}
      resumed={resumed}
      team={effectiveTeam ?? team}
      settings={withDefaults(settings)}
      pellets={pellets}
      captures={captures}
      events={events}
      heartbeat={heartbeat}
      onTeamChange={updated => setTeams(list => (list ? list.map(t => (t._id === updated._id ? updated : t)) : list))}
      onSettingsChange={onSettingsChange}
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
  /** The last heartbeat of this run, if any, so the ghosts continue after a reload. */
  heartbeat: Heartbeat | null;
  /** Takes a raw team record, as the store has it. */
  onTeamChange: (team: Team) => void;
  /** Takes the game's settings as the store has them now. */
  onSettingsChange: (settings: Settings) => void;
  onLeaveTeam: () => void;
  /** Remounted after the leader cleared or replaced the signal: skip the rules and the photo. */
  resumed: boolean;
}

/** `team` is the effective team (`withGroupStart`): never write it back. */
function Game({ team, settings, pellets, captures, events, heartbeat, onTeamChange, onSettingsChange, onLeaveTeam, resumed }: GameProps) {
  const t = useT();
  const now = useNow(250);
  const groupMode = isGroupMode(settings);
  // A phone clock behind the leader's sees the signal in the future: count down to it.
  const signalMs = signalPendingMs(settings, now);
  // For the whole run, not only until the signal: a Nulstil alle or a second
  // Start alle must reach a phone that is already out. Never in solo.
  useGroupSignal({
    enabled: groupMode,
    intervalMs: settings.groupStartedAt && signalMs === 0 ? STARTED_POLL_MS : WAITING_POLL_MS,
    gameId: team.gameId,
    onSettings: onSettingsChange,
  });
  const { fix, error: geoError } = useGeolocation();
  const rule = { lateStepS: settings.lateStepS, latePenaltyPerStep: settings.latePenaltyPerStep, latePenaltyMax: settings.latePenaltyMax };
  // The countdown has ended and the team is not home: keep looking for home.
  const serverState = phaseState(team, settings.phaseMinutes, now, rule);
  const { homeAt, markHome } = useReturnHome({
    active: serverState === 'late',
    out: serverState === 'running' || serverState === 'late',
    fix,
    team,
    settings,
    onTeamChange,
  });
  // The phone's own stamp counts before the upload lands, like queued captures.
  const returnedAt = team.returnedAt ?? homeAt;
  const state = phaseState({ startedAt: team.startedAt, returnedAt }, settings.phaseMinutes, now, rule);
  const [briefed, setBriefed] = useState(state !== 'idle' || resumed);
  // A phone that mounts mid-run skips the rules and the photo. One that is
  // still on them when the signal comes stays there until the team moves on.
  const [photoSkipped, setPhotoSkipped] = useState(state !== 'idle' || resumed);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [readyFlash, setReadyFlash] = useState(false);
  useWakeLock(state !== 'over');

  // This run only: captures from before a Nulstil that landed late must not
  // leave pellets eaten on the rerun.
  const initialEatenIds = useMemo(
    () => new Set([...ofCurrentRun(captures, team, c => c.capturedAt), ...ofCurrentRun(pending(), team, q => q.capturedAt)].map(c => c.pelletId)),
    [captures, team],
  );

  // Continue the chase from this run's last beat: same positions, same speed
  // ramp, same power and immunity timers, instead of fresh ghosts on reload.
  const restored = useMemo(() => restoredGhosts(heartbeat, team), [heartbeat, team]);
  // Fælles prikker: a dot belongs to the team that ate it first. Polled until
  // no score in the game can change any more.
  const shared = isSharedDots(settings);
  const endMs = groupEndMs(settings);
  // The engine's capture times, a render behind: the engine itself needs the owners.
  const [ownCaptures, setOwnCaptures] = useState<ReadonlyMap<string, string>>(() => initialCaptureTimes(captures, team));
  const sharedDots = useSharedDots({
    enabled: shared && (state === 'running' || state === 'late' || (state === 'over' && endMs !== null && now < endMs)),
    settings,
    pellets,
    ownTeamId: team._id,
    ownCaptures,
  });
  const ghosts = useGhosts({ active: state === 'running', fix, pellets, team, settings, initialEvents: events, restored });
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
    blockedIds: shared ? sharedDots.blockedIds : undefined,
    owners: shared ? sharedDots.owners : undefined,
  });
  useEffect(() => setOwnCaptures(engine.captureTimes), [engine.captureTimes]);
  // Another team's dots are drawn as gone.
  const mapEatenIds = useMemo(() => (shared ? new Set([...engine.eatenIds, ...sharedDots.blockedIds]) : engine.eatenIds), [shared, engine.eatenIds, sharedDots.blockedIds]);
  const firstBanner = useLostDotBanner(sharedDots.lost, sharedDots.loaded, shared && (state === 'running' || state === 'late'));
  // Publish this phone's fix and ghosts for spectators while the team is out.
  useHeartbeat({ active: state === 'running' || state === 'late', team, fix, ghosts: ghosts.ghosts });
  const late = team.startedAt ? latePenalty(team.startedAt, { ...rule, phaseMinutes: settings.phaseMinutes }, returnedAt, now) : 0;
  const points = Math.max(0, engine.points + ghosts.eventPoints - late);
  const homeDistanceM = fix && settings.start ? Math.round(haversineM(fix, settings.start)) : null;
  // Back at the start before the end: the team may stop here, safe from the ghosts.
  const canMarkHome = state === 'running' && !!fix && isUsableFix(fix) && !!settings.start && isHome(fix, settings.start, settings.homeRadiusM);

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
  // A Dobbelt another team was first to stops doubling.
  const ownedTimes = shared ? new Map([...engine.captureTimes].filter(([id]) => !sharedDots.blockedIds.has(id))) : engine.captureTimes;
  const doubleMs = doubleRemainingMs(ownedTimes, pellets, settings.doubleSeconds, now);

  const flashReady = () => {
    sound.unlock();
    sound.startJingle();
    setReadyFlash(true);
    window.setTimeout(() => setReadyFlash(false), 1500);
  };

  const showRules = !briefed;
  const showPhoto = settings.teamPhoto && !team.photoKey && !photoSkipped;
  // The team waits on the map, and the leader's signal starts it there.
  const waitingOnMap = state === 'idle' && !showRules && !showPhoto;
  const wasWaitingOnMap = useRef(waitingOnMap);
  useEffect(() => {
    if (groupMode && wasWaitingOnMap.current && state === 'running') flashReady();
    wasWaitingOnMap.current = waitingOnMap;
  }, [groupMode, state, waitingOnMap]);

  // Solo only: in a group game the leader's signal starts every team.
  const start = async () => {
    if (groupMode) return;
    setStarting(true);
    setStartError(null);
    try {
      // A solo phone does not poll, so it reads the Spilform here: if the game
      // has since become a group game, wait for the signal instead of starting.
      const fresh = await fetchGameSettings(team.gameId);
      if (fresh && isGroupMode(fresh)) {
        onSettingsChange(fresh);
        return;
      }
      const updated = await api.teams.update({ ...team, startedAt: new Date().toISOString() });
      flashReady();
      onTeamChange(updated);
    } catch {
      setStartError(t.startFailed);
    } finally {
      setStarting(false);
    }
  };

  if (geoError === 'denied' || geoError === 'unavailable') {
    return <FullScreenMessage title={t.locationDenied}>{t.locationDeniedHint}</FullScreenMessage>;
  }

  if (showRules) {
    return (
      <Briefing
        teamName={team.name}
        settings={settings}
        pellets={pellets}
        onDone={() => setBriefed(true)}
        footer={
          // Not started yet, so a phone that joined the wrong team can still leave.
          <button onClick={onLeaveTeam} className="underline text-xs text-gray-500">
            {t.changeTeam}
          </button>
        }
      />
    );
  }
  if (showPhoto) {
    return <PhotoScreen team={team} onDone={onTeamChange} onSkip={() => setPhotoSkipped(true)} />;
  }

  const eatenCount = pellets.filter(p => (shared ? ownedTimes : engine.eatenIds).has(p._id)).length;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <RunnerMap
        theme={settings.mapTheme}
        pellets={pellets}
        eatenIds={mapEatenIds}
        takenColors={shared ? sharedDots.takenColors : undefined}
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
          {groupMode ? (
            signalMs > 0 ? (
              <p className="font-arcade text-pellet text-lg text-center">{t.signalIn(Math.ceil(signalMs / 1000))}</p>
            ) : (
              <p className="text-gray-200 text-center">{fix ? t.waitingForSignal : t.locationWaiting}</p>
            )
          ) : (
            <>
              <p className="text-gray-200 text-center">{fix ? t.readyQuestion : t.locationWaiting}</p>
              {startError && <p className="font-arcade text-ghost-red text-xs">{startError}</p>}
              <ArcadeButton onClick={start} disabled={starting || !fix} className="w-full max-w-sm text-lg py-5 glow-maze">
                {starting ? t.starting : t.pressStart}
              </ArcadeButton>
            </>
          )}
          <div className="flex gap-4 text-xs text-gray-500">
            <button onClick={() => setQrOpen(true)} className="underline">
              {t.addSpectator}
            </button>
            <button onClick={() => setRulesOpen(true)} className="underline">
              {t.showRules}
            </button>
            <button onClick={onLeaveTeam} className="underline">
              {t.changeTeam}
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
          firstBanner={firstBanner}
          weakSignal={!!fix && !isUsableFix(fix)}
          onMarkHome={canMarkHome ? () => window.confirm(t.markHomeConfirm) && markHome() : undefined}
        />
      )}

      {readyFlash && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center pointer-events-none">
          <ArcadeTitle size="xl" className="blink">
            {t.ready}
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
          onLeave={onLeaveTeam}
          uploading={engine.pendingCount > 0 || eventQueue.pending().length > 0}
          sharedDots={shared}
        />
      )}

      {rulesOpen && (
        <Briefing
          overlay
          teamName={team.name}
          settings={settings}
          pellets={pellets}
          onDone={() => setRulesOpen(false)}
          footer={
            <button
              onClick={() => {
                setRulesOpen(false);
                setQrOpen(true);
              }}
              className="underline text-xs text-gray-500"
            >
              {t.addSpectator}
            </button>
          }
        />
      )}
      {qrOpen && <SpectatorQr team={team} onClose={() => setQrOpen(false)} />}
    </div>
  );
}

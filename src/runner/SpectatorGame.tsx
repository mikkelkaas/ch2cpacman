import { useEffect, useRef, useState } from 'react';
import ErrorBar from '../components/ErrorBar';
import { useNow } from '../hooks/useNow';
import { useWakeLock } from '../hooks/useWakeLock';
import { da } from '../i18n/da';
import { photoUrl } from '../lib/files';
import { haversineM } from '../lib/geo';
import { isFrightened } from '../lib/ghosts';
import { isStale, staleForMs } from '../lib/heartbeat';
import { lateMs, phaseState, remainingMs } from '../lib/phase';
import { captureTimesOf, doubleRemainingMs, scoreTeam } from '../lib/score';
import { GHOST_WARN_M } from '../lib/settings';
import { sound } from '../lib/sound';
import type { Capture, GameEvent, GameSettings, Pellet, Team } from '../lib/types';
import Briefing from './Briefing';
import GameOver from './GameOver';
import Hud from './Hud';
import RunnerMap from './RunnerMap';
import type { GhostBanner } from './useGhosts';
import { useSpectate } from './useSpectate';

interface Props {
  team: Team;
  settings: GameSettings;
  pellets: Pellet[];
  captures: Capture[];
  events: GameEvent[];
  onLeaveTeam: () => void;
}

/**
 * The runner's screen, drawn from the store instead of sensors: the team
 * record for the clock, captures and events for the score, and the runner
 * phone's heartbeat for the runner dot and the ghosts. Reads only.
 */
export default function SpectatorGame({ team: initialTeam, settings, pellets, captures: initialCaptures, events: initialEvents, onLeaveTeam }: Props) {
  const now = useNow(250);
  const { team, captures, events, heartbeat, error, retry } = useSpectate({ team: initialTeam, captures: initialCaptures, events: initialEvents });
  const rule = { lateStepS: settings.lateStepS, latePenaltyPerStep: settings.latePenaltyPerStep, latePenaltyMax: settings.latePenaltyMax };
  const state = phaseState(team, settings.phaseMinutes, now, rule);
  const [rulesOpen, setRulesOpen] = useState(false);
  useWakeLock(state === 'running' || state === 'late');

  // Score exactly as the admin and the runner do, from timestamps.
  const score = scoreTeam(team, captures, pellets, settings, events, now);
  const captureTimes = captureTimesOf(captures, team._id);
  const eatenIds = new Set(captureTimes.keys());
  const doubleMs = doubleRemainingMs(captureTimes, pellets, settings.doubleSeconds, now);

  // The runner phone's picture, and how old it is.
  const stale = isStale(heartbeat, now);
  const fix = heartbeat?.fix ? { ...heartbeat.fix } : null;
  const ghostState = heartbeat?.ghosts ?? null;
  const frightened = ghostState ? isFrightened(ghostState, now) : false;
  const ghostMode = !frightened ? 'normal' : ghostState!.frightenedUntilMs - now < 5000 ? 'flashing' : 'frightened';
  const shielded = (ghostState?.immuneUntilMs ?? 0) > now;
  const nearest = fix && ghostState ? Math.min(...ghostState.ghosts.map(g => haversineM(fix, g)), Infinity) : Infinity;
  const homeDistanceM = fix && settings.start ? Math.round(haversineM(fix, settings.start)) : null;

  // Banner and sound for each ghost event the runner phone reports, once.
  const seenEvents = useRef<Set<string>>(new Set(initialEvents.map(e => e.clientId)));
  const [banner, setBanner] = useState<GhostBanner | null>(null);
  useEffect(() => {
    for (const e of events) {
      if (seenEvents.current.has(e.clientId)) continue;
      seenEvents.current.add(e.clientId);
      setBanner({ type: e.type, points: e.points, at: Date.now() });
      if (e.type === 'ghost_caught') sound.hurt();
      else sound.ghostEaten();
    }
  }, [events]);
  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), 2000);
    return () => window.clearTimeout(id);
  }, [banner]);

  // The same cues the runner hears: a siren when the countdown ends away from
  // home, and while a ghost is close on a fresh picture.
  useEffect(() => {
    if (state === 'late') sound.siren();
  }, [state]);
  const sirenAt = useRef(0);
  useEffect(() => {
    if (state !== 'running' || stale || frightened || nearest >= GHOST_WARN_M) return;
    if (now - sirenAt.current > 450) {
      sirenAt.current = now;
      sound.siren();
    }
  }, [now, state, stale, frightened, nearest]);

  const eatenCount = pellets.filter(p => eatenIds.has(p._id)).length;
  const running = state === 'running' || state === 'late';

  return (
    <div className="relative h-full w-full overflow-hidden">
      <RunnerMap
        theme={settings.mapTheme}
        pellets={pellets}
        eatenIds={eatenIds}
        start={settings.start}
        fix={fix}
        ghosts={state === 'running' ? ghostState?.ghosts : []}
        ghostMode={ghostMode}
        shielded={state === 'running' && shielded}
        dimmed={state === 'over'}
        faded={running && stale}
        homeRadiusM={state === 'late' ? settings.homeRadiusM : null}
      />

      {error && (
        <div className="absolute top-0 inset-x-0 z-[470]">
          <ErrorBar message={da.fetchFailed} onRetry={() => void retry()} />
        </div>
      )}

      {state === 'idle' && (
        <div className="absolute inset-x-0 bottom-0 z-[450] p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            {team.photoKey && <img src={photoUrl(team.photoKey)} alt="" className="w-12 h-12 object-cover border-2 border-maze" />}
            <div className="font-arcade text-[10px] text-pellet">{team.name}</div>
          </div>
          <div className="font-arcade text-xs text-ghost-cyan">{da.spectator}</div>
          <p className="text-gray-200 text-center">{da.waitingForStart}</p>
          <p className="text-gray-500 text-center text-sm">{da.spectatorHint}</p>
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

      {running && (
        <>
          <Hud
            remainingMs={remainingMs(team.startedAt!, settings.phaseMinutes, now)}
            lateMs={state === 'late' ? lateMs(team.startedAt!, settings.phaseMinutes, now) : 0}
            latePoints={score.late}
            homeDistanceM={homeDistanceM}
            points={score.points}
            pendingCount={0}
            onShowRules={() => setRulesOpen(true)}
            doubleMs={doubleMs}
            danger={state === 'late' || (!stale && nearest < GHOST_WARN_M)}
            power={frightened}
            ghostBanner={banner}
            weakSignal={!!heartbeat && !stale && heartbeat.fix === null}
            staleForMs={heartbeat && stale ? staleForMs(heartbeat, now) : null}
          />
          {!heartbeat && (
            <div className="absolute inset-x-0 top-1/2 z-[460] flex justify-center pointer-events-none">
              <div className="font-arcade text-[10px] text-ghost-orange bg-black/80 px-3 py-2 blink">{da.waitingForRunner}</div>
            </div>
          )}
        </>
      )}

      {state === 'over' && (
        <GameOver
          points={score.points}
          pelletCount={eatenCount}
          teamName={team.name}
          photoUrl={team.photoKey ? photoUrl(team.photoKey) : null}
          late={score.late}
          homeInTime={rule.latePenaltyPerStep > 0 && !!team.returnedAt && score.late === 0}
        />
      )}

      {rulesOpen && <Briefing overlay teamName={team.name} settings={settings} pellets={pellets} onDone={() => setRulesOpen(false)} />}
    </div>
  );
}

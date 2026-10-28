import { useCallback, useMemo, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { da, formatClock } from '../i18n/da';
import { api } from '../lib/api';
import { isSharedDots, withGroupStart } from '../lib/group';
import { HEARTBEAT_MS } from '../lib/heartbeat';
import type { Heartbeat } from '../lib/heartbeat';
import { LEADER_STATUSES, leaderStatus, teamPositions } from '../lib/leader';
import type { LeaderStatus } from '../lib/leader';
import { formatCountdown, remainingMs } from '../lib/phase';
import { dotOwners, scoreTeam } from '../lib/score';
import { withDefaults } from '../lib/settings';
import type { Capture, Game, GameEvent, Pellet, Settings, Team } from '../lib/types';
import LeaderMap from './LeaderMap';
import { startGroup } from './groupActions';
import QrDialog from './QrDialog';
import StartAllButton from './StartAllButton';
import { Button } from './ui';

/** Leaders hand out QR codes from here, so a team started elsewhere shows up quickly. */
const POLL_MS = 5_000;

type Filter = LeaderStatus | 'all';
type View = 'list' | 'map';

/**
 * The page the leaders at the post keep open on their phones: every team of
 * one game, where it is, its QR code and its score.
 */
export default function LeaderPage({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [pellets, setPellets] = useState<Pellet[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [filter, setFilter] = useState<Filter>('notPlayed');
  // The teams the QR was opened on, kept while it is open: the team that
  // starts on it leaves "Ikke spillet" but may still want a spectator code.
  const [qr, setQr] = useState<{ teams: Team[]; id: string } | null>(null);
  const [view, setView] = useState<View>('list');
  const [showDots, setShowDots] = useState(true);
  const [beats, setBeats] = useState<Heartbeat[]>([]);
  const [startFailed, setStartFailed] = useState(false);
  const now = useNow(1000);

  const loadStatic = useCallback(async () => {
    const [gameList, pelletList] = await Promise.all([api.games.list({ _id: gameId }), api.pellets.list({ gameId })]);
    setGame(gameList[0] ?? null);
    setPellets(pelletList);
  }, [gameId]);

  // Settings too: a new run length from the admin page should reach the leaders.
  const loadLive = useCallback(async () => {
    const [teamList, captureList, eventList, settingsList] = await Promise.all([
      api.teams.list({ gameId }),
      api.captures.list({ gameId }),
      api.events.list({ gameId }),
      api.settings.list({ gameId }),
    ]);
    setTeams(teamList);
    setCaptures(captureList);
    setEvents(eventList);
    setSettings(settingsList[0] ?? null);
  }, [gameId]);

  // Only the runner phones' beats, and only while the map is open: as often as they are written.
  const loadBeats = useCallback(async () => setBeats(await api.heartbeats.list({ gameId })), [gameId]);

  const staticPoll = usePolling(loadStatic, 60_000);
  const livePoll = usePolling(loadLive, POLL_MS);
  const beatPoll = usePolling(loadBeats, HEARTBEAT_MS, view === 'map');

  const full = useMemo(() => (settings ? withDefaults(settings) : null), [settings]);
  // In a group mode the start is the group signal, whatever the stored record says.
  const effectiveTeams = useMemo(() => (full ? teams.map(t => withGroupStart(t, full)) : teams), [teams, full]);
  // Shared dots: who ate which dot, once for the whole game.
  const owners = useMemo(
    () => (full && pellets && isSharedDots(full) ? dotOwners(effectiveTeams, captures, pellets, full) : undefined),
    [effectiveTeams, captures, pellets, full],
  );
  const freePellets = useMemo(() => (pellets && owners ? pellets.filter(p => !owners.has(p._id)) : pellets), [pellets, owners]);
  const rows = useMemo(() => {
    if (!full || !pellets) return [];
    return effectiveTeams
      .map(team => ({ team, status: leaderStatus(team, full, now), points: scoreTeam(team, captures, pellets, full, events, now, owners).points }))
      .sort((a, b) => a.team.name.localeCompare(b.team.name, 'da'));
  }, [effectiveTeams, captures, events, pellets, full, now, owners]);
  const running = useMemo(() => rows.filter(r => r.status === 'running').map(r => r.team), [rows]);
  const positions = useMemo(() => teamPositions(running, beats, now), [running, beats, now]);
  const clocks = useMemo(() => {
    const left = (t: Team) => (t.startedAt && full ? remainingMs(t.startedAt, full.phaseMinutes, now) : 0);
    return new Map(running.map(t => [t._id, left(t) === 0 ? da.leaderLate : formatCountdown(left(t))]));
  }, [running, full, now]);

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
  if (!game || !full || !pellets) {
    return shell(
      <div className="p-8 text-center text-gray-600">
        {staticPoll.error || livePoll.error ? (
          <>
            <p className="text-red-700 mb-3">{da.fetchFailed}</p>
            <Button
              onClick={() => {
                void staticPoll.reload();
                void livePoll.reload();
              }}
            >
              {da.retry}
            </Button>
          </>
        ) : (
          <p>{da.loading}</p>
        )}
      </div>,
    );
  }

  const shown = filter === 'all' ? rows : rows.filter(r => r.status === filter);
  const count = (f: Filter) => (f === 'all' ? rows.length : rows.filter(r => r.status === f).length);
  const error = startFailed ? da.saveFailed : livePoll.error || staticPoll.error || (view === 'map' && beatPoll.error) ? da.fetchFailed : null;
  const unplaced = running.filter(t => !positions.some(p => p.team._id === t._id));

  return shell(
    <div className={`flex flex-col ${view === 'map' ? 'h-dvh' : 'max-w-xl mx-auto'}`}>
      <header className="sticky top-0 z-10 bg-gray-100 px-4 pt-3 pb-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold truncate">
            {game.name} · {da.leadersTitle}
          </h1>
          <a href={`#/admin/${gameId}`} className="text-blue-700 text-sm hover:underline shrink-0">
            {da.adminLink} →
          </a>
        </div>
        <div className="flex rounded-md border border-gray-300 overflow-hidden self-start text-sm">
          {(['list', 'map'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 ${view === v ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-700'}`}
            >
              {v === 'list' ? da.leaderListView : da.leaderMapView}
            </button>
          ))}
        </div>
        <StartAllButton
          settings={full}
          pelletCount={pellets.length}
          teamCount={teams.length}
          onStart={async () => {
            setStartFailed(false);
            try {
              await startGroup(gameId);
            } catch {
              setStartFailed(true);
              return;
            }
            await livePoll.reload();
          }}
        />
        {view === 'list' && (
        <div className="flex flex-wrap gap-2">
          {[...LEADER_STATUSES, 'all' as const].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-sm px-3 py-1 rounded-full border ${filter === f ? 'bg-blue-600 border-blue-600 text-white font-medium' : 'bg-white border-gray-300 text-gray-700'}`}
            >
              {f === 'all' ? da.allTeams : da.leaderStatus[f]} {count(f)}
            </button>
          ))}
        </div>
        )}
        {view === 'map' && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-600">{da.runningOnMap(positions.filter(p => !p.stale).length, running.length)}</span>
            <label className="flex items-center gap-2 font-medium cursor-pointer shrink-0">
              <input type="checkbox" checked={showDots} onChange={e => setShowDots(e.target.checked)} className="w-5 h-5" />
              {da.showDots}
            </label>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 bg-red-100 text-red-800 px-3 py-2 text-sm rounded-md border border-red-200">
            <span>{error}</span>
            <button
              className="underline"
              onClick={() => {
                setStartFailed(false);
                void livePoll.reload();
                if (view === 'map') void beatPoll.reload();
              }}
            >
              {da.retry}
            </button>
          </div>
        )}
      </header>

      {view === 'map' && (
        <main className="flex-1 min-h-0 flex flex-col">
          {unplaced.length > 0 && <p className="px-4 pb-2 text-sm text-gray-500">{da.noPosition(unplaced.map(t => `${t.name} (${clocks.get(t._id)})`).join(', '))}</p>}
          <div className="flex-1 min-h-0">
            <LeaderMap pellets={freePellets ?? pellets} start={full.start} positions={positions} clocks={clocks} showDots={showDots} />
          </div>
        </main>
      )}

      {view === 'list' && (
      <main className="px-4 pb-6 flex flex-col gap-2">
        {shown.length === 0 && <p className="text-gray-500 text-sm py-6 text-center">{da.noTeamsHere}</p>}
        {shown.map(({ team, status, points }) => (
          <TeamCard
            key={team._id}
            team={team}
            status={status}
            points={points}
            clock={team.startedAt ? formatCountdown(remainingMs(team.startedAt, full.phaseMinutes, now)) : ''}
            late={!!team.startedAt && remainingMs(team.startedAt, full.phaseMinutes, now) === 0}
            onShowQr={() => setQr({ teams: shown.map(r => r.team), id: team._id })}
          />
        ))}
        {livePoll.lastLoadedAt && <p className="text-xs text-gray-400 text-center pt-2">{da.refreshed(formatClock(livePoll.lastLoadedAt))}</p>}
      </main>
      )}

      {qr && <QrDialog teams={qr.teams} initialId={qr.id} onClose={() => setQr(null)} />}
    </div>,
  );
}

interface CardProps {
  team: Team;
  status: LeaderStatus;
  points: number;
  /** Time left while running. */
  clock: string;
  /** The countdown is over and the team is on its way home. */
  late: boolean;
  onShowQr: () => void;
}

const BADGE: Record<LeaderStatus, string> = {
  notPlayed: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
};

function TeamCard({ team, status, points, clock, late, onShowQr }: CardProps) {
  const finished = status === 'done';
  const badge = status === 'running' ? (late ? da.leaderLate : da.leaderRunning(clock)) : finished ? da.finished : da.leaderStatus.notPlayed;
  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-3 h-3 rounded-full border border-gray-300 shrink-0" style={{ background: team.color }} />
          <span className="font-semibold truncate">{team.name}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 tabular-nums ${BADGE[status]}`}>{badge}</span>
      </div>

      {status === 'running' && <div className="text-sm text-gray-600">{da.pointsSoFar(points)}</div>}
      {finished && <div className="text-2xl font-bold tabular-nums">{da.gamePoints(points)}</div>}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button onClick={onShowQr} className="py-2">
            {da.showQr}
          </Button>
          <span className="font-mono text-sm text-gray-500 tracking-widest">{team.code}</span>
        </div>
      </div>
    </section>
  );
}

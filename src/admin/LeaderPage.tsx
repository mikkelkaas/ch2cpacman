import { useCallback, useMemo, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { usePolling } from '../hooks/usePolling';
import { da, formatClock } from '../i18n/da';
import { api } from '../lib/api';
import { EVENT_MAX, eventScore, LEADER_STATUSES, leaderStatus } from '../lib/leader';
import type { LeaderStatus } from '../lib/leader';
import { formatCountdown, remainingMs } from '../lib/phase';
import { scoreTeam } from '../lib/score';
import { withDefaults } from '../lib/settings';
import type { Capture, Game, GameEvent, Pellet, Settings, Team } from '../lib/types';
import QrDialog from './QrDialog';
import { Button } from './ui';

/** Leaders hand out QR codes from here, so a team started elsewhere shows up quickly. */
const POLL_MS = 5_000;

type Filter = LeaderStatus | 'all';

/**
 * The page the leaders at the post keep open on their phones: every team of
 * one game, where it is, its QR code, its score and the 0–20 for e-vent, and
 * a shared tick for "entered in e-vent".
 */
export default function LeaderPage({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [pellets, setPellets] = useState<Pellet[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  // Ticks saved or on their way: shown at once, and kept until a poll agrees,
  // so a poll that left before the save does not flip the box back.
  const [pending, setPending] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [writeError, setWriteError] = useState(false);
  const [filter, setFilter] = useState<Filter>('notPlayed');
  // The teams the QR was opened on, kept while it is open: the team that
  // starts on it leaves "Ikke spillet" but may still want a spectator code.
  const [qr, setQr] = useState<{ teams: Team[]; id: string } | null>(null);
  const now = useNow(1000);

  const loadStatic = useCallback(async () => {
    const [gameList, pelletList] = await Promise.all([api.games.list({ _id: gameId }), api.pellets.list({ gameId })]);
    setGame(gameList[0] ?? null);
    setPellets(pelletList);
  }, [gameId]);

  // Settings too: a new divisor from the admin page should reach the leaders.
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
    setPending(map => {
      const left = new Map([...map].filter(([id, value]) => teamList.find(t => t._id === id)?.eventSubmitted !== value));
      return left.size === map.size ? map : left;
    });
  }, [gameId]);

  const staticPoll = usePolling(loadStatic, 60_000);
  const livePoll = usePolling(loadLive, POLL_MS);

  const setSubmitted = async (team: Team, value: boolean) => {
    setPending(map => new Map(map).set(team._id, value));
    try {
      // PUT replaces the whole record: build it on the team as the store has it now.
      const current = (await api.teams.list({ _id: team._id }))[0] ?? team;
      const saved = await api.teams.update({ ...current, eventSubmitted: value });
      setTeams(list => list.map(t => (t._id === saved._id ? saved : t)));
      setWriteError(false);
    } catch {
      setPending(map => {
        const next = new Map(map);
        next.delete(team._id);
        return next;
      });
      setWriteError(true);
    }
  };

  const full = useMemo(() => (settings ? withDefaults(settings) : null), [settings]);
  const rows = useMemo(() => {
    if (!full || !pellets) return [];
    return teams
      .map(t => (pending.has(t._id) ? { ...t, eventSubmitted: pending.get(t._id) } : t))
      .map(team => ({ team, status: leaderStatus(team, full, now), points: scoreTeam(team, captures, pellets, full, events, now).points }))
      .sort((a, b) => a.team.name.localeCompare(b.team.name, 'da'));
  }, [teams, pending, captures, events, pellets, full, now]);

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
  const error = writeError ? da.saveFailed : livePoll.error || staticPoll.error ? da.fetchFailed : null;

  return shell(
    <div className="max-w-xl mx-auto flex flex-col">
      <header className="sticky top-0 z-10 bg-gray-100 px-4 pt-3 pb-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold truncate">
            {game.name} · {da.leadersTitle}
          </h1>
          <a href={`#/admin/${gameId}`} className="text-blue-700 text-sm hover:underline shrink-0">
            {da.adminLink} →
          </a>
        </div>
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
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 bg-red-100 text-red-800 px-3 py-2 text-sm rounded-md border border-red-200">
            <span>{error}</span>
            <button
              className="underline"
              onClick={() => {
                setWriteError(false);
                void livePoll.reload();
              }}
            >
              {da.retry}
            </button>
          </div>
        )}
      </header>

      <main className="px-4 pb-6 flex flex-col gap-2">
        {shown.length === 0 && <p className="text-gray-500 text-sm py-6 text-center">{da.noTeamsHere}</p>}
        {shown.map(({ team, status, points }) => (
          <TeamCard
            key={team._id}
            team={team}
            status={status}
            points={points}
            eventPoints={eventScore(points, full.eventDivisor)}
            clock={team.startedAt ? formatCountdown(remainingMs(team.startedAt, full.phaseMinutes, now)) : ''}
            late={!!team.startedAt && remainingMs(team.startedAt, full.phaseMinutes, now) === 0}
            onShowQr={() => setQr({ teams: shown.map(r => r.team), id: team._id })}
            onSubmittedChange={value => void setSubmitted(team, value)}
          />
        ))}
        {livePoll.lastLoadedAt && <p className="text-xs text-gray-400 text-center pt-2">{da.refreshed(formatClock(livePoll.lastLoadedAt))}</p>}
      </main>

      {qr && <QrDialog teams={qr.teams} initialId={qr.id} onClose={() => setQr(null)} />}
    </div>,
  );
}

interface CardProps {
  team: Team;
  status: LeaderStatus;
  points: number;
  eventPoints: number;
  /** Time left while running. */
  clock: string;
  /** The countdown is over and the team is on its way home. */
  late: boolean;
  onShowQr: () => void;
  onSubmittedChange: (value: boolean) => void;
}

const BADGE: Record<LeaderStatus, string> = {
  notPlayed: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-800',
  missingEvent: 'bg-amber-100 text-amber-800',
  done: 'bg-green-100 text-green-800',
};

function TeamCard({ team, status, points, eventPoints, clock, late, onShowQr, onSubmittedChange }: CardProps) {
  const finished = status === 'missingEvent' || status === 'done';
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
      {finished && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-gray-600">{da.gamePoints(points)}</span>
          <span className="text-sm text-gray-500">
            e-vent <span className="text-2xl font-bold text-gray-900 tabular-nums">{eventPoints}</span> {da.eventOutOf(EVENT_MAX)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button onClick={onShowQr} className="py-2">
            {da.showQr}
          </Button>
          <span className="font-mono text-sm text-gray-500 tracking-widest">{team.code}</span>
        </div>
        {finished && (
          <label className="flex items-center gap-2 text-sm font-medium py-2 cursor-pointer">
            <input type="checkbox" checked={!!team.eventSubmitted} onChange={e => onSubmittedChange(e.target.checked)} className="w-5 h-5" />
            {da.eventSubmitted}
          </label>
        )}
      </div>
    </section>
  );
}

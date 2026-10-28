import { useCallback, useMemo, useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { isGroupMode, withGroupStart } from '../lib/group';
import { HEARTBEAT_MS } from '../lib/heartbeat';
import type { Heartbeat } from '../lib/heartbeat';
import { withDefaults } from '../lib/settings';
import type { Capture, GameEvent, GameSettings, Team } from '../lib/types';

interface Initial {
  team: Team;
  captures: Capture[];
  events: GameEvent[];
}

/**
 * Everything a spectator shows, read from the store every HEARTBEAT_MS with
 * filters on this team: the team record for start and return, captures and
 * events for the score, and the runner phone's heartbeat for the map. In a
 * group game also the game's settings, for the leader's signal; the returned
 * team is then the effective one (`withGroupStart`). A failed poll keeps the
 * last good data and surfaces the error for a retry bar.
 */
export function useSpectate(initial: Initial, initialSettings: GameSettings, enabled = true) {
  const [rawTeam, setRawTeam] = useState(initial.team);
  const [settings, setSettings] = useState(initialSettings);
  const [captures, setCaptures] = useState(initial.captures);
  const [events, setEvents] = useState(initial.events);
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
  const teamId = initial.team._id;
  const gameId = initialSettings.gameId;
  const groupMode = isGroupMode(initialSettings);

  const load = useCallback(async () => {
    const [teamList, captureList, eventList, beats, settingsList] = await Promise.all([
      api.teams.list({ _id: teamId }),
      api.captures.list({ teamId }),
      api.events.list({ teamId }),
      api.heartbeats.list({ teamId }),
      // Records from before games existed have no gameId to filter on.
      groupMode ? api.settings.list(gameId ? { gameId } : undefined) : Promise.resolve(null),
    ]);
    if (teamList[0]) setRawTeam(teamList[0]);
    setCaptures(captureList);
    setEvents(eventList);
    setHeartbeat(beats[0] ?? null);
    const current = settingsList?.find(s => (gameId ? s.gameId === gameId : !s.gameId));
    if (current) setSettings(withDefaults(current));
  }, [teamId, gameId, groupMode]);

  const { error, reload } = usePolling(load, HEARTBEAT_MS, enabled);
  // Only for display, never written back.
  const team = useMemo(() => withGroupStart(rawTeam, settings), [rawTeam, settings]);
  return { team, settings, captures, events, heartbeat, error, retry: reload };
}

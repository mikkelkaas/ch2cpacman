import { useCallback, useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { HEARTBEAT_MS } from '../lib/heartbeat';
import type { Heartbeat } from '../lib/heartbeat';
import type { Capture, GameEvent, Team } from '../lib/types';

interface Initial {
  team: Team;
  captures: Capture[];
  events: GameEvent[];
}

/**
 * Everything a spectator shows, read from the store every HEARTBEAT_MS with
 * filters on this team: the team record for start and return, captures and
 * events for the score, and the runner phone's heartbeat for the map. A
 * failed poll keeps the last good data and surfaces the error for a retry bar.
 */
export function useSpectate(initial: Initial, enabled = true) {
  const [team, setTeam] = useState(initial.team);
  const [captures, setCaptures] = useState(initial.captures);
  const [events, setEvents] = useState(initial.events);
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
  const teamId = initial.team._id;

  const load = useCallback(async () => {
    const [teamList, captureList, eventList, beats] = await Promise.all([
      api.teams.list({ _id: teamId }),
      api.captures.list({ teamId }),
      api.events.list({ teamId }),
      api.heartbeats.list({ teamId }),
    ]);
    if (teamList[0]) setTeam(teamList[0]);
    setCaptures(captureList);
    setEvents(eventList);
    setHeartbeat(beats[0] ?? null);
  }, [teamId]);

  const { error, reload } = usePolling(load, HEARTBEAT_MS, enabled);
  return { team, captures, events, heartbeat, error, retry: reload };
}

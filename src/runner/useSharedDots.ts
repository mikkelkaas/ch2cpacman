import { useEffect, useMemo, useRef, useState } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import { withGroupStart } from '../lib/group';
import { dotOwners } from '../lib/score';
import { lostDots, takenDots, withOwnCaptures } from '../lib/sharedDots';
import { sound } from '../lib/sound';
import type { Capture, GameSettings, Pellet, Team } from '../lib/types';

const POLL_MS = 3000;
const BANNER_MS = 2000;

interface Options {
  enabled: boolean;
  settings: GameSettings;
  pellets: readonly Pellet[];
  ownTeamId: string;
  /** The phone's own captures, pellet id to ISO time, uploaded or not. */
  ownCaptures: ReadonlyMap<string, string>;
}

/**
 * Fælles prikker: polls every team and capture of the game since the signal,
 * and decides who owns each dot, the phone's own unuploaded captures
 * included. A failed poll keeps the last result. Before the first poll the
 * phone's own dots are simply its own.
 */
export function useSharedDots({ enabled, settings, pellets, ownTeamId, ownCaptures }: Options) {
  const [server, setServer] = useState<{ teams: Team[]; captures: Capture[] } | null>(null);
  const gameId = settings.gameId;
  const since = settings.groupStartedAt;

  usePolling(
    async () => {
      const [teams, captures] = await Promise.all([api.teams.list({ gameId }), api.captures.list({ gameId, capturedAt: { $gte: since } })]);
      setServer({ teams, captures });
    },
    POLL_MS,
    enabled && !!since && !!gameId,
  );

  const teams = useMemo(() => (server ? server.teams.map(t => withGroupStart(t, settings)) : []), [server, settings]);

  const owners: ReadonlyMap<string, string> = useMemo(() => {
    if (!server) {
      const listed = new Set(pellets.map(p => p._id));
      return new Map([...ownCaptures.keys()].filter(id => listed.has(id)).map(id => [id, ownTeamId]));
    }
    return dotOwners(teams, withOwnCaptures(server.captures, ownTeamId, ownCaptures), pellets, settings);
  }, [server, teams, ownCaptures, pellets, settings, ownTeamId]);

  return useMemo(() => {
    const byId = new Map(teams.map(t => [t._id, t]));
    const taken = takenDots(owners, ownTeamId);
    const lost = new Map([...lostDots(ownCaptures, owners, ownTeamId)].flatMap(([pelletId, teamId]) => (byId.has(teamId) ? [[pelletId, byId.get(teamId)!] as const] : [])));
    return {
      /** The first poll is in: `lost` from here on is the server's word. */
      loaded: server !== null,
      owners,
      teams,
      /** Dots another team owns: never eaten here, drawn as gone. */
      blockedIds: new Set(taken.keys()) as ReadonlySet<string>,
      /** Pellet id to the owning team's colour, for the flash as a dot goes. */
      takenColors: new Map([...taken].map(([pelletId, teamId]) => [pelletId, byId.get(teamId)?.color ?? '#ffffff'])) as ReadonlyMap<string, string>,
      /** Dots this phone ate that another team was first to: pellet id to that team. */
      lost: lost as ReadonlyMap<string, Team>,
    };
  }, [server, owners, teams, ownCaptures, ownTeamId]);
}

/**
 * Names the team that was first to a dot this phone ate, once per dot, for
 * two seconds, with the hurt sound. Only while `active` (the HUD is up).
 * The dots already lost in the first poll (`loaded` turning true) were lost
 * before this screen opened, on a reload or a spectator joining: they are
 * taken as announced, not announced again.
 */
export function useLostDotBanner(lost: ReadonlyMap<string, Team>, loaded: boolean, active: boolean): string | null {
  const announced = useRef<Set<string> | null>(null);
  const [banner, setBanner] = useState<{ name: string; at: number } | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (!announced.current) {
      announced.current = new Set(lost.keys());
      return;
    }
    if (!active) return;
    const seen = announced.current;
    const fresh = [...lost].filter(([pelletId]) => !seen.has(pelletId));
    if (fresh.length === 0) return;
    for (const [pelletId] of fresh) seen.add(pelletId);
    setBanner({ name: fresh[fresh.length - 1][1].name, at: Date.now() });
    sound.hurt();
  }, [lost, loaded, active]);

  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), BANNER_MS);
    return () => window.clearTimeout(id);
  }, [banner]);

  return banner?.name ?? null;
}

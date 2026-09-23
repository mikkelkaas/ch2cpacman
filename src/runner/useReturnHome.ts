import { useEffect, useRef, useState } from 'react';
import type { Fix } from '../hooks/useGeolocation';
import { api } from '../lib/api';
import { isUsableFix } from '../lib/fix';
import { isHome } from '../lib/late';
import type { GameSettings, Team } from '../lib/types';

const RETRY_MS = 5000;

interface Options {
  /** The countdown has ended and the team is not home yet. */
  active: boolean;
  fix: Fix | null;
  team: Team;
  settings: GameSettings;
  onTeamChange: (team: Team) => void;
}

/**
 * Stamps `returnedAt` the first time a usable fix lands inside the home radius
 * after the countdown. The phone trusts its own stamp at once so the screen
 * settles, and keeps retrying the upload until the server has it.
 *
 * The leader can stamp the team home too (Hjemme). While the team is out the
 * phone watches for that, and when it writes its own stamp it re-reads the
 * record first and keeps the earlier of the two, so neither overwrites the
 * other with a later time. A record reset meanwhile (Nulstil) is adopted, not
 * written over.
 */
export function useReturnHome({ active, fix, team, settings, onTeamChange }: Options): { homeAt: string | null } {
  const [homeAt, setHomeAt] = useState<string | null>(null);
  const teamRef = useRef(team);
  teamRef.current = team;
  const onTeamChangeRef = useRef(onTeamChange);
  onTeamChangeRef.current = onTeamChange;

  // A stamp belongs to one run: a Nulstil and a new Start must not inherit it.
  useEffect(() => setHomeAt(null), [team.startedAt]);

  useEffect(() => {
    if (!active || homeAt || team.returnedAt || !fix || !isUsableFix(fix) || !settings.start) return;
    if (isHome(fix, settings.start, settings.homeRadiusM)) setHomeAt(new Date().toISOString());
  }, [active, homeAt, team.returnedAt, fix, settings.start, settings.homeRadiusM]);

  // Out and not home by GPS yet: pick up the leader's stamp so the phone
  // stops asking the team to run home.
  useEffect(() => {
    if (!active || homeAt || team.returnedAt) return;
    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        const current = (await api.teams.list({ _id: teamRef.current._id }))[0];
        if (!cancelled && current?.returnedAt) onTeamChangeRef.current(current);
      } catch {
        // Offline: the next poll tries again, and GPS may get there first.
      }
    }, RETRY_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active, homeAt, team.returnedAt]);

  useEffect(() => {
    if (!homeAt || team.returnedAt) return;
    let cancelled = false;
    let timer: number | undefined;
    const attempt = async () => {
      try {
        const current = (await api.teams.list({ _id: teamRef.current._id }))[0] ?? teamRef.current;
        const sameRun = current.startedAt === teamRef.current.startedAt;
        const leaderFirst = !!current.returnedAt && current.returnedAt <= homeAt;
        const updated = !sameRun || leaderFirst ? current : await api.teams.update({ ...current, returnedAt: homeAt });
        if (!cancelled) onTeamChangeRef.current(updated);
      } catch {
        if (!cancelled) timer = window.setTimeout(() => void attempt(), RETRY_MS);
      }
    };
    void attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [homeAt, team.returnedAt]);

  return { homeAt };
}

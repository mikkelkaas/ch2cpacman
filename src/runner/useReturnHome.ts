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
 */
export function useReturnHome({ active, fix, team, settings, onTeamChange }: Options): { homeAt: string | null } {
  const [homeAt, setHomeAt] = useState<string | null>(null);
  const teamRef = useRef(team);
  teamRef.current = team;
  const onTeamChangeRef = useRef(onTeamChange);
  onTeamChangeRef.current = onTeamChange;

  useEffect(() => {
    if (!active || homeAt || team.returnedAt || !fix || !isUsableFix(fix) || !settings.start) return;
    if (isHome(fix, settings.start, settings.homeRadiusM)) setHomeAt(new Date().toISOString());
  }, [active, homeAt, team.returnedAt, fix, settings.start, settings.homeRadiusM]);

  useEffect(() => {
    if (!homeAt || team.returnedAt) return;
    let cancelled = false;
    let timer: number | undefined;
    const attempt = async () => {
      try {
        const updated = await api.teams.update({ ...teamRef.current, returnedAt: homeAt });
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

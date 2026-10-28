import { useRef } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import type { Settings } from '../lib/types';

/** Waiting for the signal: the start should be felt at once. */
export const WAITING_POLL_MS = 2000;
/** After the signal: only a Nulstil alle or a new Start alle can still come. */
export const STARTED_POLL_MS = 5000;

/** The game's settings as the store has them now; null if there are none. */
export async function fetchGameSettings(gameId: string | undefined): Promise<Settings | null> {
  // Records from before games existed have no gameId to filter on.
  const list = await api.settings.list(gameId ? { gameId } : undefined);
  return list.find(s => (gameId ? s.gameId === gameId : !s.gameId)) ?? null;
}

interface Options {
  /** A group game is open. Never in solo: a solo phone does not poll. */
  enabled: boolean;
  intervalMs: number;
  gameId: string | undefined;
  onSettings: (s: Settings) => void;
}

/**
 * Watches a group game's settings for the leader's Start alle, a Nulstil
 * alle, a second Start alle or a Spilform change, and hands every read over;
 * the receiver decides what changed (`settingsChange`). A failed read is
 * retried on the next poll.
 */
export function useGroupSignal({ enabled, intervalMs, gameId, onSettings }: Options): void {
  const onSettingsRef = useRef(onSettings);
  onSettingsRef.current = onSettings;

  usePolling(
    async () => {
      const current = await fetchGameSettings(gameId);
      if (current) onSettingsRef.current(current);
    },
    intervalMs,
    enabled,
  );
}

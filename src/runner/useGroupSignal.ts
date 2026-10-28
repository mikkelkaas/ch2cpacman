import { useRef } from 'react';
import { usePolling } from '../hooks/usePolling';
import { api } from '../lib/api';
import type { Settings } from '../lib/types';

const POLL_MS = 2000;

interface Options {
  /** A group game whose signal has not come yet, or still lies in the future. */
  enabled: boolean;
  gameId: string | undefined;
  onSettings: (s: Settings) => void;
}

/**
 * Waits for the leader's Start alle: polls the game's settings and hands the
 * record over whenever its `groupStartedAt` differs from the last one seen
 * (the first read always counts, so a signal given while the game loaded is
 * not missed). A failed read is retried on the next poll.
 */
export function useGroupSignal({ enabled, gameId, onSettings }: Options): void {
  const onSettingsRef = useRef(onSettings);
  onSettingsRef.current = onSettings;
  const lastSeen = useRef<string | null | undefined>(undefined);

  usePolling(
    async () => {
      // Records from before games existed have no gameId to filter on.
      const list = await api.settings.list(gameId ? { gameId } : undefined);
      const current = list.find(s => (gameId ? s.gameId === gameId : !s.gameId));
      if (!current) return;
      const signal = current.groupStartedAt ?? null;
      if (signal === lastSeen.current) return;
      lastSeen.current = signal;
      onSettingsRef.current(current);
    },
    POLL_MS,
    enabled,
  );
}

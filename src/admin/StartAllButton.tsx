import { useState } from 'react';
import { da } from '../i18n/da';
import { groupEndMs, isGroupMode } from '../lib/group';
import { formatCountdown, remainingMs } from '../lib/phase';
import type { GameSettings } from '../lib/types';
import { useNow } from '../hooks/useNow';
import { Button, Panel } from './ui';

interface Props {
  settings: GameSettings;
  pelletCount: number;
  teamCount: number;
  onStart: () => Promise<void>;
}

/** The leader's one button in a group mode; afterwards the shared clock. */
export default function StartAllButton({ settings, pelletCount, teamCount, onStart }: Props) {
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  if (!isGroupMode(settings)) return null;

  const { groupStartedAt } = settings;
  if (groupStartedAt) {
    const left = remainingMs(groupStartedAt, settings.phaseMinutes, now);
    const over = now >= (groupEndMs(settings) ?? Infinity);
    return (
      <Panel title={da.startAll}>
        <p className="text-sm text-gray-900">{over ? da.groupOver : left > 0 ? da.groupRunning(formatCountdown(left)) : da.groupTimeUp}</p>
      </Panel>
    );
  }

  const ready = !!settings.start && pelletCount > 0;
  const start = async () => {
    if (!confirm(da.confirmStartAll(teamCount))) return;
    setBusy(true);
    try {
      await onStart();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title={da.startAll}>
      <Button variant="primary" disabled={!ready || busy} onClick={() => void start()}>
        {da.startAll}
      </Button>
      {!ready && <p className="text-amber-700 text-sm">{da.startAllNeeds}</p>}
    </Panel>
  );
}

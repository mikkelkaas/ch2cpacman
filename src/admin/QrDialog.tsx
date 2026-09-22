import { useEffect, useState } from 'react';
import { joinUrl } from '../lib/route';
import { da } from '../i18n/da';
import type { Team } from '../lib/types';
import QrCode from './QrCode';
import { Button } from './ui';

interface Props {
  teams: readonly Team[];
  initialId: string;
  onClose: () => void;
}

/**
 * Full-screen QR for one team, with next/previous so a leader can hold up a
 * phone to a queue of patrols and step through them.
 */
export default function QrDialog({ teams, initialId, onClose }: Props) {
  const [index, setIndex] = useState(Math.max(0, teams.findIndex(t => t._id === initialId)));
  const team = teams[index];
  const url = joinUrl(team.code);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex(i => Math.min(teams.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, teams.length]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] bg-white flex flex-col items-center justify-between p-4 text-center text-gray-900">
      <div className="w-full flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {index + 1} / {teams.length}
        </span>
        <Button onClick={onClose}>{da.close}</Button>
      </div>
      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
        <div className="text-2xl font-semibold flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full border border-gray-300" style={{ background: team.color }} />
          {team.name}
        </div>
        <QrCode text={url} className="w-full max-w-xs [&>svg]:w-full [&>svg]:h-auto" />
        <div className="font-mono text-4xl tracking-[0.3em]">{team.code}</div>
        <p className="text-sm text-gray-500">{da.qrTitle}</p>
        <p className="text-xs text-gray-400 break-all">{da.qrOrType(`${window.location.origin}${window.location.pathname}`)}</p>
      </div>
      <div className="w-full max-w-sm flex gap-2">
        <Button className="flex-1 py-3" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>
          ← {da.prevTeam}
        </Button>
        <Button className="flex-1 py-3" variant="primary" disabled={index === teams.length - 1} onClick={() => setIndex(i => i + 1)}>
          {da.nextTeam} →
        </Button>
      </div>
    </div>
  );
}

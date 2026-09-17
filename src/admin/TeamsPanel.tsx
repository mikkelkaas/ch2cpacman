import { useState } from 'react';
import type { FormEvent } from 'react';
import ArcadeButton from '../components/ArcadeButton';
import { da, formatClock } from '../i18n/da';
import { phaseEndMs, phaseState } from '../lib/phase';
import type { Team } from '../lib/types';

interface Props {
  teams: readonly Team[];
  phaseMinutes: number;
  now: number;
  onAdd: (name: string) => Promise<void>;
  onReset: (team: Team) => Promise<void>;
  onDelete: (team: Team) => Promise<void>;
}

export default function TeamsPanel({ teams, phaseMinutes, now, onAdd, onReset, onDelete }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onAdd(trimmed);
      setName('');
    } finally {
      setBusy(false);
    }
  };

  const stateLabel = (team: Team) => {
    const state = phaseState(team, phaseMinutes, now);
    if (state === 'idle') return <span className="text-gray-500">{da.notStarted}</span>;
    if (state === 'running') return <span className="text-ghost-cyan">{da.runningUntil(formatClock(phaseEndMs(team.startedAt!, phaseMinutes)))}</span>;
    return <span className="text-pellet">{da.finished}</span>;
  };

  return (
    <section className="border-4 border-maze p-4 flex flex-col gap-3">
      <h2 className="font-arcade text-pac text-xs">
        {da.teams} <span className="text-pellet">({teams.length})</span>
      </h2>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={da.teamName}
          className="flex-1 min-w-0 bg-black text-gray-100 border-2 border-maze px-3 py-2 outline-none"
        />
        <ArcadeButton type="submit" disabled={busy || !name.trim()} className="text-[10px] py-2">
          {da.addTeam}
        </ArcadeButton>
      </form>
      {teams.length === 0 && <p className="text-gray-500 text-sm">{da.noTeams}</p>}
      <ul className="flex flex-col divide-y divide-blue-950">
        {[...teams]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map(team => (
            <li key={team._id} className="py-3 flex items-center gap-3">
              <span className="w-4 h-4 shrink-0" style={{ background: team.color, boxShadow: `0 0 6px ${team.color}` }} />
              <div className="flex-1 min-w-0">
                <div className="text-gray-100 truncate">{team.name}</div>
                <div className="text-xs">{stateLabel(team)}</div>
              </div>
              <div className="font-arcade text-pac text-xl tracking-widest" title={da.code}>
                {team.code}
              </div>
              <div className="flex flex-col gap-1 text-xs items-end">
                <button onClick={() => confirm(da.confirmReset(team.name)) && void onReset(team)} className="text-ghost-orange underline" disabled={!team.startedAt}>
                  {da.reset}
                </button>
                <button onClick={() => confirm(da.confirmDeleteTeam(team.name)) && void onDelete(team)} className="text-ghost-red underline">
                  {da.delete}
                </button>
              </div>
            </li>
          ))}
      </ul>
    </section>
  );
}

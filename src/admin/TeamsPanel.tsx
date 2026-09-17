import { useState } from 'react';
import type { FormEvent } from 'react';
import { da, formatClock } from '../i18n/da';
import { photoUrl } from '../lib/files';
import { phaseEndMs, phaseState } from '../lib/phase';
import type { Team } from '../lib/types';
import QrDialog from './QrDialog';
import { Button, inputClass, Panel } from './ui';

interface Props {
  teams: readonly Team[];
  phaseMinutes: number;
  now: number;
  onAdd: (names: string[]) => Promise<void>;
  onReset: (team: Team) => Promise<void>;
  onDelete: (team: Team) => Promise<void>;
}

/** One team per line; blank lines and duplicates within the paste are dropped. */
export function parseTeamNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim();
    const key = name.toLocaleLowerCase('da');
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export default function TeamsPanel({ teams, phaseMinutes, now, onAdd, onReset, onDelete }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [qrTeamId, setQrTeamId] = useState<string | null>(null);
  const sorted = [...teams].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const names = parseTeamNames(text);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (names.length === 0) return;
    setBusy(true);
    try {
      await onAdd(names);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  const stateLabel = (team: Team) => {
    const state = phaseState(team, phaseMinutes, now);
    if (state === 'idle') return <span className="text-gray-500">{da.notStarted}</span>;
    if (state === 'running') return <span className="text-blue-700">{da.runningUntil(formatClock(phaseEndMs(team.startedAt!, phaseMinutes)))}</span>;
    return <span className="text-green-700">{da.finished}</span>;
  };

  return (
    <Panel title={<>{da.teams} <span className="text-gray-400 font-normal">({teams.length})</span></>}>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label className="text-sm text-gray-700" htmlFor="team-names">
          {da.teamNames}
        </label>
        <textarea
          id="team-names"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={da.teamNamesPlaceholder}
          rows={3}
          className={`${inputClass} w-full font-mono`}
        />
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={busy || names.length === 0}>
            {da.addTeams(Math.max(1, names.length))}
          </Button>
        </div>
      </form>
      {teams.length === 0 && <p className="text-gray-500 text-sm">{da.noTeams}</p>}
      {teams.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="py-1 pr-2">{da.team}</th>
              <th className="py-1 pr-2">{da.code}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map(team => (
                <tr key={team._id}>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      {team.photoKey ? (
                        <a href={photoUrl(team.photoKey)} target="_blank" rel="noreferrer" title={da.photo}>
                          <img src={photoUrl(team.photoKey)} alt="" className="w-10 h-10 object-cover rounded border border-gray-300" />
                        </a>
                      ) : (
                        <span className="w-10 h-10 rounded border border-dashed border-gray-300 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0 border border-gray-300" style={{ background: team.color }} />
                          <span className="text-gray-900">{team.name}</span>
                        </div>
                        <div className="text-xs pl-5">{stateLabel(team)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-2 font-mono text-lg tracking-widest text-gray-900">{team.code}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => setQrTeamId(team._id)} className="text-blue-700 hover:underline text-xs mr-3">
                      {da.showQr}
                    </button>
                    <button onClick={() => confirm(da.confirmReset(team.name)) && void onReset(team)} className="text-amber-700 hover:underline text-xs disabled:text-gray-300 disabled:no-underline mr-3" disabled={!team.startedAt}>
                      {da.reset}
                    </button>
                    <button onClick={() => confirm(da.confirmDeleteTeam(team.name)) && void onDelete(team)} className="text-red-600 hover:underline text-xs">
                      {da.delete}
                    </button>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      )}
      {qrTeamId && <QrDialog teams={sorted} initialId={qrTeamId} onClose={() => setQrTeamId(null)} />}
    </Panel>
  );
}

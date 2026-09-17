import { useEffect, useState } from 'react';
import { da } from '../i18n/da';
import { haversineM } from '../lib/geo';
import type { LatLng, Pellet } from '../lib/types';
import { inputClass, Panel } from './ui';

interface Props {
  pellets: readonly Pellet[];
  start: LatLng | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (pellet: Pellet) => Promise<void>;
  onDelete: (pellet: Pellet) => Promise<void>;
}

export default function PelletsPanel({ pellets, start, selectedId, onSelect, onSave, onDelete }: Props) {
  const sorted = [...pellets]
    .map(p => ({ pellet: p, distance: start ? haversineM(start, p) : null }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  return (
    <Panel title={<>{da.pellets} <span className="text-gray-400 font-normal">({pellets.length})</span></>}>
      <p className="text-sm text-gray-500">{da.mapHint}</p>
      {pellets.length === 0 && <p className="text-gray-500 text-sm">{da.noPellets}</p>}
      {sorted.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="py-1 pr-2">{da.pointsLabel}</th>
              <th className="py-1 pr-2">{da.name}</th>
              <th className="py-1 pr-2">{da.radius}</th>
              <th className="py-1 pr-2 text-right">{da.distance}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map(({ pellet, distance }) => (
              <PelletRow
                key={pellet._id}
                pellet={pellet}
                distance={distance}
                selected={pellet._id === selectedId}
                onSelect={() => onSelect(pellet._id === selectedId ? null : pellet._id)}
                onSave={onSave}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

interface RowProps {
  pellet: Pellet;
  distance: number | null;
  selected: boolean;
  onSelect: () => void;
  onSave: (pellet: Pellet) => Promise<void>;
  onDelete: (pellet: Pellet) => Promise<void>;
}

function PelletRow({ pellet, distance, selected, onSelect, onSave, onDelete }: RowProps) {
  const [draft, setDraft] = useState(pellet);
  useEffect(() => setDraft(pellet), [pellet]);

  const commit = () => {
    const next: Pellet = {
      ...draft,
      name: draft.name.trim() || pellet.name,
      points: Math.max(1, Math.round(Number(draft.points) || 1)),
      radiusM: Math.max(5, Math.round(Number(draft.radiusM) || 15)),
    };
    setDraft(next);
    if (next.name !== pellet.name || next.points !== pellet.points || next.radiusM !== pellet.radiusM) void onSave(next);
  };
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.currentTarget.blur();

  return (
    <tr className={selected ? 'bg-amber-50' : ''} onClick={onSelect}>
      <td className="py-1.5 pr-2" onClick={e => e.stopPropagation()}>
        <input type="number" min={1} value={draft.points} onChange={e => setDraft({ ...draft, points: Number(e.target.value) })} onBlur={commit} onKeyDown={blurOnEnter} className={`${inputClass} w-16 font-semibold`} aria-label={da.pointsLabel} />
      </td>
      <td className="py-1.5 pr-2" onClick={e => e.stopPropagation()}>
        <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} onBlur={commit} onKeyDown={blurOnEnter} className={`${inputClass} w-full min-w-24`} aria-label={da.name} />
      </td>
      <td className="py-1.5 pr-2" onClick={e => e.stopPropagation()}>
        <input type="number" min={5} step={5} value={draft.radiusM} onChange={e => setDraft({ ...draft, radiusM: Number(e.target.value) })} onBlur={commit} onKeyDown={blurOnEnter} className={`${inputClass} w-16`} aria-label={da.radius} />
      </td>
      <td className="py-1.5 pr-2 text-right text-gray-500 whitespace-nowrap">{distance === null ? '–' : `${Math.round(distance)} m`}</td>
      <td className="py-1.5 text-right" onClick={e => e.stopPropagation()}>
        <button onClick={() => confirm(da.confirmDeletePellet(pellet.name)) && void onDelete(pellet)} className="text-red-600 hover:underline text-xs">
          {da.delete}
        </button>
      </td>
    </tr>
  );
}

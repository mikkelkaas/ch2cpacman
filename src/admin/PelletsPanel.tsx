import { useEffect, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton';
import { da } from '../i18n/da';
import { haversineM } from '../lib/geo';
import type { LatLng, Pellet } from '../lib/types';
import type { MapMode } from './AdminMap';

interface Props {
  pellets: readonly Pellet[];
  start: LatLng | null;
  selectedId: string | null;
  mode: MapMode;
  onSelect: (id: string | null) => void;
  onSetMode: (mode: MapMode) => void;
  onSave: (pellet: Pellet) => Promise<void>;
  onDelete: (pellet: Pellet) => Promise<void>;
}

export default function PelletsPanel({ pellets, start, selectedId, mode, onSelect, onSetMode, onSave, onDelete }: Props) {
  const arming = mode === 'addPellet';
  const sorted = [...pellets]
    .map(p => ({ pellet: p, distance: start ? haversineM(start, p) : null }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  return (
    <section className="border-4 border-maze p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-arcade text-pac text-xs">
          {da.pellets} <span className="text-pellet">({pellets.length})</span>
        </h2>
        <ArcadeButton variant={arming ? 'danger' : 'primary'} onClick={() => onSetMode(arming ? 'idle' : 'addPellet')} className="text-[10px] py-2">
          {arming ? da.cancel : da.addPellet}
        </ArcadeButton>
      </div>
      {arming && <p className="text-ghost-orange text-xs blink">{da.addPelletHint}</p>}
      {pellets.length === 0 && <p className="text-gray-500 text-sm">{da.noPellets}</p>}
      <ul className="flex flex-col divide-y divide-blue-950">
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
      </ul>
    </section>
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
      radiusM: Math.max(5, Math.round(Number(draft.radiusM) || 25)),
    };
    setDraft(next);
    if (next.name !== pellet.name || next.points !== pellet.points || next.radiusM !== pellet.radiusM) void onSave(next);
  };
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.currentTarget.blur();
  const input = 'bg-black text-gray-100 border-2 border-blue-950 focus:border-maze px-2 py-1 outline-none';

  return (
    <li className={`py-2 flex flex-col gap-2 ${selected ? 'bg-blue-950/40 -mx-2 px-2' : ''}`}>
      <div className="flex items-center gap-2">
        <button onClick={onSelect} className="font-arcade text-pac text-sm w-10 shrink-0 text-left" title={da.pointsLabel}>
          {pellet.points}
        </button>
        <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} onBlur={commit} onKeyDown={blurOnEnter} className={`${input} flex-1 min-w-0`} aria-label={da.name} />
        <span className="text-gray-400 text-xs w-16 text-right shrink-0">{distance === null ? '–' : `${Math.round(distance)} m`}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <label className="flex items-center gap-1">
          {da.pointsLabel}
          <input type="number" min={1} value={draft.points} onChange={e => setDraft({ ...draft, points: Number(e.target.value) })} onBlur={commit} onKeyDown={blurOnEnter} className={`${input} w-16 font-arcade text-pac`} />
        </label>
        <label className="flex items-center gap-1">
          {da.radius}
          <input type="number" min={5} step={5} value={draft.radiusM} onChange={e => setDraft({ ...draft, radiusM: Number(e.target.value) })} onBlur={commit} onKeyDown={blurOnEnter} className={`${input} w-16`} />
        </label>
        <button onClick={() => confirm(da.confirmDeletePellet(pellet.name)) && void onDelete(pellet)} className="ml-auto text-ghost-red underline">
          {da.delete}
        </button>
      </div>
    </li>
  );
}

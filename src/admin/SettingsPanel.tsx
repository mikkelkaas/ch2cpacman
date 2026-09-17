import { useEffect, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton';
import { da } from '../i18n/da';
import type { Settings } from '../lib/types';
import type { MapMode } from './AdminMap';

interface Props {
  settings: Settings;
  mode: MapMode;
  onSave: (settings: Settings) => Promise<void>;
  onSetMode: (mode: MapMode) => void;
}

export default function SettingsPanel({ settings, mode, onSave, onSetMode }: Props) {
  const [minutes, setMinutes] = useState(String(settings.phaseMinutes));
  useEffect(() => setMinutes(String(settings.phaseMinutes)), [settings.phaseMinutes]);

  const commit = () => {
    const value = Math.min(120, Math.max(1, Math.round(Number(minutes) || settings.phaseMinutes)));
    setMinutes(String(value));
    if (value !== settings.phaseMinutes) void onSave({ ...settings, phaseMinutes: value });
  };

  const arming = mode === 'setStart';
  return (
    <section className="border-4 border-maze p-4 flex flex-col gap-3">
      <h2 className="font-arcade text-pac text-xs">{da.settings}</h2>
      <label className="flex items-center justify-between gap-3 text-sm text-gray-200">
        {da.phaseMinutes}
        <input
          type="number"
          min={1}
          max={120}
          value={minutes}
          onChange={e => setMinutes(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="font-arcade w-24 bg-black text-pac border-2 border-maze px-2 py-1 text-right"
        />
      </label>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-400">
          {settings.start ? `${settings.start.lat.toFixed(5)}, ${settings.start.lng.toFixed(5)}` : da.startNotSet}
        </span>
        <ArcadeButton variant={arming ? 'danger' : 'ghost'} onClick={() => onSetMode(arming ? 'idle' : 'setStart')} className="text-[10px] py-2">
          {arming ? da.cancel : da.setStart}
        </ArcadeButton>
      </div>
      {arming && <p className="text-ghost-orange text-xs blink">{da.setStartHint}</p>}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { da } from '../i18n/da';
import type { Settings } from '../lib/types';
import type { MapMode } from './AdminMap';
import { Button, inputClass, Panel } from './ui';

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
    <Panel title={da.settings}>
      <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
        {da.phaseMinutes}
        <input
          type="number"
          min={1}
          max={120}
          value={minutes}
          onChange={e => setMinutes(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`${inputClass} w-24 text-right`}
        />
      </label>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-500 flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-green-600 border border-white shadow" />
          {settings.start ? `${settings.start.lat.toFixed(5)}, ${settings.start.lng.toFixed(5)}` : da.startNotSet}
        </span>
        <Button variant={arming ? 'danger' : 'secondary'} onClick={() => onSetMode(arming ? 'idle' : 'setStart')}>
          {arming ? da.cancel : da.setStart}
        </Button>
      </div>
      {arming && <p className="text-amber-700 text-sm">{da.setStartHint}</p>}
    </Panel>
  );
}

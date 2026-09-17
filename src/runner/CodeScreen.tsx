import { useState } from 'react';
import type { FormEvent } from 'react';
import ArcadeButton from '../components/ArcadeButton';
import ArcadeTitle from '../components/ArcadeTitle';
import { da } from '../i18n/da';
import { sound } from '../lib/sound';
import { CODE_LENGTH, normalizeCode } from '../lib/teamCode';
import type { Team } from '../lib/types';

export default function CodeScreen({ teams, onJoin }: { teams: readonly Team[]; onJoin: (team: Team) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    sound.unlock();
    const team = teams.find(t => t.code === code);
    if (!team) {
      setError(da.unknownCode);
      return;
    }
    sound.blip();
    onJoin(team);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-8 p-6 scanlines relative">
      <ArcadeTitle size="xl">{da.title}</ArcadeTitle>
      <form onSubmit={submit} className="flex flex-col items-center gap-5 w-full max-w-xs">
        <label className="font-arcade text-pellet text-xs" htmlFor="code">
          {da.enterCode}
        </label>
        <input
          id="code"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={e => {
            setCode(normalizeCode(e.target.value).slice(0, CODE_LENGTH));
            setError(null);
          }}
          placeholder={da.codePlaceholder}
          className="font-arcade text-3xl tracking-[0.5em] text-center w-full bg-black text-pac border-4 border-maze py-4 outline-none focus:glow-maze placeholder:text-blue-900"
        />
        {error && <p className="font-arcade text-ghost-red text-xs blink">{error}</p>}
        <ArcadeButton type="submit" disabled={code.length !== CODE_LENGTH} className="w-full">
          {da.join}
        </ArcadeButton>
      </form>
    </div>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import ArcadeButton from '../components/ArcadeButton';
import ArcadeTitle from '../components/ArcadeTitle';
import { da } from '../i18n/da';
import type { Role } from '../lib/route';
import { sound } from '../lib/sound';
import { CODE_LENGTH, normalizeCode } from '../lib/teamCode';
import type { Team } from '../lib/types';

interface Props {
  teams: readonly Team[];
  /** Preselected from the address: a #/watch link that matched no team lands here as a spectator. */
  initialRole?: Role;
  onJoin: (team: Team, role: Role) => void;
}

export default function CodeScreen({ teams, initialRole = 'runner', onJoin }: Props) {
  const [code, setCode] = useState('');
  const [role, setRole] = useState<Role>(initialRole);
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
    onJoin(team, role);
  };

  const roleButton = (value: Role, label: string) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      aria-pressed={role === value}
      className={`font-arcade text-xs flex-1 py-3 border-2 ${role === value ? 'border-pac text-pac glow-pac' : 'border-maze text-blue-400'}`}
    >
      {label}
    </button>
  );

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
        <div className="w-full flex flex-col gap-2">
          <div className="font-arcade text-pellet text-[9px] text-center">{da.roleQuestion}</div>
          <div className="flex gap-2 w-full">
            {roleButton('runner', da.roleRunner)}
            {roleButton('spectator', da.roleSpectator)}
          </div>
        </div>
        {error && <p className="font-arcade text-ghost-red text-xs blink">{error}</p>}
        <ArcadeButton type="submit" disabled={code.length !== CODE_LENGTH} className="w-full">
          {da.join}
        </ArcadeButton>
      </form>
    </div>
  );
}

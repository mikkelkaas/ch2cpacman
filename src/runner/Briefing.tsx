import ArcadeButton from '../components/ArcadeButton';
import ArcadeTitle from '../components/ArcadeTitle';
import { da } from '../i18n/da';
import { sound } from '../lib/sound';
import type { GameSettings, Pellet } from '../lib/types';

interface Props {
  teamName: string;
  settings: GameSettings;
  pellets: readonly Pellet[];
  onDone: () => void;
  /** Overlay mode: shown over the map after the game has started. */
  overlay?: boolean;
}

export default function Briefing({ teamName, settings, pellets, onDone, overlay = false }: Props) {
  const rules = da.rules({
    minutes: settings.phaseMinutes,
    ghosts: settings.ghostCount > 0,
    penalty: settings.ghostPenalty,
    bonus: settings.ghostBonus,
    hasPower: pellets.some(p => p.kind === 'power'),
    hasDouble: pellets.some(p => p.kind === 'double'),
  });
  return (
    <div className={`${overlay ? 'absolute inset-0 z-[500] bg-black/95' : 'min-h-full'} flex flex-col items-center justify-center gap-6 p-6 overflow-y-auto scanlines`}>
      <p className="font-arcade text-pellet text-[10px]">{da.yourTeam}</p>
      <ArcadeTitle>{teamName}</ArcadeTitle>
      <h2 className="font-arcade text-maze text-sm sm:text-base mt-2" style={{ color: '#5c5cff' }}>
        {da.howToPlay}
      </h2>
      <ol className="flex flex-col gap-4 w-full max-w-md">
        {rules.map((rule, i) => (
          <li key={i} className="flex items-start gap-4 border-l-4 border-maze pl-4">
            <span className="font-arcade text-pac text-lg w-8 shrink-0 text-center" aria-hidden>
              {rule.icon}
            </span>
            <span className="text-gray-100 text-base leading-snug">{rule.text}</span>
          </li>
        ))}
      </ol>
      <ArcadeButton
        onClick={() => {
          sound.unlock();
          sound.blip();
          onDone();
        }}
        className="w-full max-w-md mt-2"
      >
        {overlay ? da.close : da.next}
      </ArcadeButton>
    </div>
  );
}

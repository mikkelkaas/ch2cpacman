import { useEffect } from 'react';
import ArcadeTitle from '../components/ArcadeTitle';
import { da } from '../i18n/da';
import { sound } from '../lib/sound';

interface Props {
  points: number;
  pelletCount: number;
  teamName: string;
  photoUrl?: string | null;
  /** Points lost for coming home late. */
  late?: number;
  /** The rule is on and the team made it home without losing anything. */
  homeInTime?: boolean;
}

export default function GameOver({ points, pelletCount, teamName, photoUrl = null, late = 0, homeInTime = false }: Props) {
  useEffect(() => {
    sound.gameOver();
  }, []);
  return (
    <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-6 p-6 text-center pointer-events-none">
      <div className="drop-in">
        <ArcadeTitle size="xl" className="text-ghost-red" >
          <span style={{ color: '#ff0000', textShadow: '0 0 8px #ff0000' }}>{da.gameOver}</span>
        </ArcadeTitle>
      </div>
      <div className="bg-black/90 border-4 border-maze px-8 py-6 flex flex-col gap-3 drop-in pointer-events-auto items-center">
        {photoUrl && <img src={photoUrl} alt="" className="w-40 h-30 object-cover border-2 border-maze" />}
        <div className="font-arcade text-[10px] text-pellet">{teamName}</div>
        <div className="font-arcade text-[10px] text-pellet">{da.finalScore}</div>
        <div className="font-arcade text-5xl text-pac glow-pac tabular-nums">{String(points).padStart(4, '0')}</div>
        <div className="text-gray-300">{da.pelletsEaten(pelletCount)}</div>
        {late > 0 && <div className="text-ghost-red">{da.lateLine(late)}</div>}
        {homeInTime && <div className="text-ghost-cyan">{da.homeInTime}</div>}
        <div className="text-gray-400 text-sm mt-2">{da.wellPlayed}</div>
      </div>
    </div>
  );
}

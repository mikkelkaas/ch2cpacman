import { useEffect, useRef, useState } from 'react';
import MuteToggle from '../components/MuteToggle';
import { da } from '../i18n/da';
import { formatCountdown } from '../lib/phase';

import type { GhostBanner } from './useGhosts';

interface Props {
  remainingMs: number;
  /** Milliseconds past the end while the team is still out; 0 otherwise. */
  lateMs?: number;
  /** Late penalty so far. */
  latePoints?: number;
  /** Straight-line distance to the start point, when known. */
  homeDistanceM?: number | null;
  points: number;
  pendingCount: number;
  onShowRules: () => void;
  /** Milliseconds of Dobbelt left, 0 when inactive. */
  doubleMs?: number;
  /** A ghost is within warning distance. */
  danger?: boolean;
  /** Ghosts are frightened. */
  power?: boolean;
  ghostBanner?: GhostBanner | null;
  /** The latest fix is too inaccurate to count. */
  weakSignal?: boolean;
  /** Spectator only: milliseconds since the runner phone's last beat when it has gone quiet, else null. */
  staleForMs?: number | null;
}

/** Score that counts up digit by digit, the arcade way. */
function useRollingNumber(target: number): number {
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (shown === target) return;
    const step = target > shown ? 1 : -1;
    const id = window.setTimeout(() => setShown(s => s + step), 40);
    return () => window.clearTimeout(id);
  }, [shown, target]);
  return shown;
}

export default function Hud({ remainingMs, lateMs = 0, latePoints = 0, homeDistanceM = null, points, pendingCount, onShowRules, doubleMs = 0, danger = false, power = false, ghostBanner = null, weakSignal = false, staleForMs = null }: Props) {
  const shownPoints = useRollingNumber(points);
  const late = lateMs > 0;
  const low = late || (remainingMs > 0 && remainingMs < 60_000);
  const pendingSince = useRef<number | null>(null);
  const [showWaiting, setShowWaiting] = useState(false);

  useEffect(() => {
    if (pendingCount === 0) {
      pendingSince.current = null;
      setShowWaiting(false);
      return;
    }
    pendingSince.current ??= Date.now();
    const id = window.setInterval(() => {
      setShowWaiting(Date.now() - (pendingSince.current ?? Date.now()) > 10_000);
    }, 1000);
    return () => window.clearInterval(id);
  }, [pendingCount]);

  return (
    <>
      {danger && !power && <div className="danger-vignette" />}
      {power && <div className="power-vignette" />}
      <div className="absolute top-0 inset-x-0 z-[450] flex items-start justify-between p-3 pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="bg-black/80 border-2 border-maze px-3 py-2 pointer-events-auto">
            <div className="font-arcade text-[9px] text-pellet">{late ? da.lateLabel : da.time}</div>
            <div className={`font-arcade text-2xl ${low ? 'text-ghost-red blink' : 'text-pac'}`}>{late ? `+${formatCountdown(lateMs)}` : formatCountdown(remainingMs)}</div>
          </div>
          {doubleMs > 0 && (
            <div className="bg-black/80 border-2 border-ghost-cyan px-3 py-1 font-arcade text-ghost-cyan text-sm">
              {da.double} {formatCountdown(doubleMs)}
            </div>
          )}
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={onShowRules} aria-label={da.showRules} className="font-arcade text-pac border-2 border-maze bg-black/80 px-3 py-1 text-sm">
            ?
          </button>
          <MuteToggle />
        </div>
      </div>
      {late && (
        <div className="absolute inset-x-0 top-1/4 z-[460] flex flex-col items-center gap-2 pointer-events-none text-center">
          <div className="font-arcade text-3xl text-ghost-red blink" style={{ textShadow: '0 0 10px #ff0000' }}>
            {da.runHome}
          </div>
          {homeDistanceM !== null && <div className="font-arcade text-sm text-pac bg-black/80 px-3 py-1">{da.homeDistance(homeDistanceM)}</div>}
          {latePoints > 0 && <div className="font-arcade text-sm text-ghost-red bg-black/80 px-3 py-1">{da.latePoints(latePoints)}</div>}
        </div>
      )}
      {ghostBanner && (
        <div className="absolute inset-x-0 top-1/3 z-[460] flex justify-center pointer-events-none">
          <div className={`font-arcade text-2xl drop-in ${ghostBanner.type === 'ghost_caught' ? 'text-ghost-red' : 'text-ghost-cyan'}`} style={{ textShadow: '0 0 8px currentColor' }}>
            {ghostBanner.type === 'ghost_caught' ? da.caughtBanner(-ghostBanner.points) : da.ghostEatenBanner(ghostBanner.points)}
          </div>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 z-[450] flex flex-col items-center gap-1 p-3 pointer-events-none">
        {staleForMs !== null && <div className="font-arcade text-[9px] text-ghost-orange bg-black/80 px-2 py-1">{da.lastSeen(Math.round(staleForMs / 1000))}</div>}
        {weakSignal && <div className="font-arcade text-[9px] text-ghost-orange bg-black/80 px-2 py-1 blink">{da.weakSignal}</div>}
        {showWaiting && <div className="font-arcade text-[9px] text-ghost-orange bg-black/80 px-2 py-1">{da.waitingForNetwork}</div>}
        <div className="bg-black/80 border-2 border-maze px-4 py-2 text-center">
          <div className="font-arcade text-[9px] text-pellet">{da.score}</div>
          <div className="font-arcade text-3xl text-pac glow-pac tabular-nums">{String(shownPoints).padStart(4, '0')}</div>
        </div>
      </div>
    </>
  );
}

import QrCode from '../admin/QrCode';
import ArcadeButton from '../components/ArcadeButton';
import { da } from '../i18n/da';
import { joinUrl } from '../lib/route';
import type { Team } from '../lib/types';

/** Full-screen QR for the watch address, shown on the runner's phone so others can join as spectators. */
export default function SpectatorQr({ team, onClose }: { team: Team; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="absolute inset-0 z-[550] bg-black/95 flex flex-col items-center justify-center gap-5 p-6 text-center scanlines">
      <div className="font-arcade text-pellet text-xs">{da.spectatorQrTitle}</div>
      <div className="bg-white p-3 border-4 border-maze w-full max-w-xs">
        <QrCode text={joinUrl(team.code, 'spectator')} className="w-full [&>svg]:w-full [&>svg]:h-auto" />
      </div>
      <div className="font-arcade text-2xl text-pac tracking-[0.3em]">{team.code}</div>
      <p className="text-gray-400 text-sm max-w-xs">{da.spectatorQrHint}</p>
      <ArcadeButton onClick={onClose} className="w-full max-w-xs">
        {da.close}
      </ArcadeButton>
    </div>
  );
}

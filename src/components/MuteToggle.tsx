import { useState } from 'react';
import { da } from '../i18n/da';
import { sound } from '../lib/sound';

export default function MuteToggle({ className = '' }: { className?: string }) {
  const [muted, setMuted] = useState(sound.isMuted());
  const toggle = () => {
    const next = !muted;
    sound.setMuted(next);
    setMuted(next);
    if (!next) {
      sound.unlock();
      sound.blip();
    }
  };
  return (
    <button
      onClick={toggle}
      aria-label={muted ? da.unmute : da.mute}
      aria-pressed={muted}
      className={`font-arcade text-pac border-2 border-maze bg-black/80 px-2 py-1 text-sm ${className}`}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

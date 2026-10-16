import { useState } from 'react';
import { useT } from '../i18n/LangProvider';
import { sound } from '../lib/sound';

export default function MuteToggle({ className = '' }: { className?: string }) {
  const t = useT();
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
      aria-label={muted ? t.unmute : t.mute}
      aria-pressed={muted}
      className={`font-arcade text-pac border-2 border-maze bg-black/80 px-2 py-1 text-sm ${className}`}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

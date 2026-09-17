import { useEffect, useRef, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton';
import ArcadeTitle from '../components/ArcadeTitle';
import { da } from '../i18n/da';
import { api } from '../lib/api';
import { PHOTO_BUCKET, putFile, teamPhotoKey } from '../lib/files';
import { shrinkImage } from '../lib/image';
import { sound } from '../lib/sound';
import type { Team } from '../lib/types';

interface Props {
  team: Team;
  onDone: (team: Team) => void;
  onSkip: () => void;
}

/**
 * Team photo before the start. The camera input opens the phone camera
 * directly; the picture is shrunk in the browser, PUT to the photo bucket and
 * its key written on the team. Skipping is allowed: a photo must never block
 * a run.
 */
export default function PhotoScreen({ team, onDone, onSkip }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      setBlob(await shrinkImage(file));
      sound.blip();
    } catch {
      setError(da.photoFailed);
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!blob) return;
    setBusy(true);
    setError(null);
    try {
      const key = teamPhotoKey(team);
      await putFile(PHOTO_BUCKET, key, blob, 'image/jpeg');
      const saved = await api.teams.update({ ...team, photoKey: key });
      sound.blip();
      onDone(saved);
    } catch {
      setError(da.photoFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-5 p-6 scanlines relative">
      <p className="font-arcade text-pellet text-[10px]">{team.name}</p>
      <ArcadeTitle>{da.photoTitle}</ArcadeTitle>
      <p className="text-gray-200 text-center max-w-sm">{da.photoHint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => void pick(e.target.files?.[0])}
        data-testid="photo-input"
      />
      <div className="w-full max-w-sm aspect-[4/3] border-4 border-maze bg-black flex items-center justify-center overflow-hidden">
        {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <span className="font-arcade text-maze text-4xl" style={{ color: '#5c5cff' }}>📷</span>}
      </div>
      {error && <p className="font-arcade text-ghost-red text-[10px] text-center">{error}</p>}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {!blob && (
          <ArcadeButton onClick={() => inputRef.current?.click()} disabled={busy} className="w-full py-4">
            {da.takePhoto}
          </ArcadeButton>
        )}
        {blob && (
          <>
            <ArcadeButton onClick={upload} disabled={busy} className="w-full py-4">
              {busy ? da.uploadingPhoto : da.usePhoto}
            </ArcadeButton>
            <ArcadeButton variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy} className="w-full">
              {da.retakePhoto}
            </ArcadeButton>
          </>
        )}
        <button onClick={onSkip} className="text-gray-500 underline text-sm" disabled={busy}>
          {da.skipPhoto}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { LatLng } from '../lib/types';

export interface Fix extends LatLng {
  accuracyM: number;
  at: number;
}

export type GeoError = 'denied' | 'unavailable' | null;

export function useGeolocation(enabled = true): { fix: Fix | null; error: GeoError } {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<GeoError>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!('geolocation' in navigator)) {
      setError('unavailable');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      pos => {
        setError(null);
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          at: pos.timestamp,
        });
      },
      err => {
        setError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { fix, error };
}

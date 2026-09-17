import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Fix } from '../hooks/useGeolocation';
import { headingDeg } from '../lib/geo';
import { boundsOf, createDarkMap, pacmanIcon, pelletIcon, startIcon } from '../lib/leaflet';
import type { LatLng, Pellet } from '../lib/types';

interface Props {
  pellets: readonly Pellet[];
  eatenIds: ReadonlySet<string>;
  start: LatLng | null;
  fix: Fix | null;
  dimmed?: boolean;
}

export default function RunnerMap({ pellets, eatenIds, start, fix, dimmed = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pelletLayers = useRef(new Map<string, L.Marker>());
  const eatenShown = useRef(new Set<string>());
  const startMarker = useRef<L.Marker | null>(null);
  const runnerMarker = useRef<L.Marker | null>(null);
  const accuracyRing = useRef<L.Circle | null>(null);
  const prevFix = useRef<Fix | null>(null);
  const headingRef = useRef(90);
  const fitted = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // No zoom buttons: they sit where the countdown goes, and phones pinch.
    mapRef.current = createDarkMap(containerRef.current, { center: [56, 10], zoom: 6, zoomControl: false });
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Pellets: add new ones, animate eaten ones away.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const pellet of pellets) {
      const eaten = eatenIds.has(pellet._id);
      const existing = pelletLayers.current.get(pellet._id);
      if (eaten) {
        if (existing && !eatenShown.current.has(pellet._id)) {
          eatenShown.current.add(pellet._id);
          existing.setIcon(pelletIcon(pellet, 'eaten'));
          window.setTimeout(() => {
            existing.remove();
            pelletLayers.current.delete(pellet._id);
          }, 320);
        }
        continue;
      }
      if (!existing) {
        const marker = L.marker([pellet.lat, pellet.lng], { icon: pelletIcon(pellet), interactive: false, keyboard: false });
        marker.addTo(map);
        pelletLayers.current.set(pellet._id, marker);
      }
    }
    if (!fitted.current) {
      const bounds = boundsOf([...pellets, ...(start ? [start] : [])]);
      if (bounds) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
        fitted.current = true;
      }
    }
  }, [pellets, eatenIds, start]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !start) return;
    startMarker.current ??= L.marker([start.lat, start.lng], { icon: startIcon(), interactive: false }).addTo(map);
    startMarker.current.setLatLng([start.lat, start.lng]);
  }, [start]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fix) return;
    const prev = prevFix.current;
    if (prev && (prev.lat !== fix.lat || prev.lng !== fix.lng)) headingRef.current = headingDeg(prev, fix);
    prevFix.current = fix;
    const pos: [number, number] = [fix.lat, fix.lng];
    if (!runnerMarker.current) {
      runnerMarker.current = L.marker(pos, { icon: pacmanIcon(headingRef.current), interactive: false, zIndexOffset: 1000 }).addTo(map);
      accuracyRing.current = L.circle(pos, { radius: fix.accuracyM, color: '#ffe600', weight: 1, opacity: 0.5, fillOpacity: 0.08 }).addTo(map);
    } else {
      runnerMarker.current.setLatLng(pos).setIcon(pacmanIcon(headingRef.current));
      accuracyRing.current?.setLatLng(pos).setRadius(fix.accuracyM);
    }
  }, [fix]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {dimmed && <div className="absolute inset-0 bg-black/70 z-[400] pointer-events-none" />}
    </div>
  );
}

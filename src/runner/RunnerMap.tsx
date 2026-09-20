import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Fix } from '../hooks/useGeolocation';
import { headingDeg } from '../lib/geo';
import type { Ghost } from '../lib/ghosts';
import { boundsOf, createDarkMap, ghostIcon, pacmanIcon, pelletIcon, startIcon } from '../lib/leaflet';
import type { LatLng, MapTheme, Pellet } from '../lib/types';

interface Props {
  theme: MapTheme;
  pellets: readonly Pellet[];
  eatenIds: ReadonlySet<string>;
  start: LatLng | null;
  fix: Fix | null;
  ghosts?: readonly Ghost[];
  ghostMode?: 'normal' | 'frightened' | 'flashing';
  /** Draw a dashed ring around the runner while immune after a catch. */
  shielded?: boolean;
  dimmed?: boolean;
  /** Draw the home radius around the start and a line to it from the runner. */
  homeRadiusM?: number | null;
}

export default function RunnerMap({ theme, pellets, eatenIds, start, fix, ghosts = [], ghostMode = 'normal', shielded = false, dimmed = false, homeRadiusM = null }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pelletLayers = useRef(new Map<string, L.Marker>());
  const eatenShown = useRef(new Set<string>());
  const startMarker = useRef<L.Marker | null>(null);
  const runnerMarker = useRef<L.Marker | null>(null);
  const accuracyRing = useRef<L.Circle | null>(null);
  const shieldRing = useRef<L.Circle | null>(null);
  const homeRing = useRef<L.Circle | null>(null);
  const homeLine = useRef<L.Polyline | null>(null);
  const ghostMarkers = useRef(new Map<number, L.Marker>());
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
      accuracyRing.current = L.circle(pos, { radius: fix.accuracyM, color: '#2121ff', weight: 1, opacity: 0.6, fillOpacity: 0.08 }).addTo(map);
    } else {
      runnerMarker.current.setLatLng(pos).setIcon(pacmanIcon(headingRef.current));
      accuracyRing.current?.setLatLng(pos).setRadius(fix.accuracyM);
    }
  }, [fix]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<number>();
    for (const ghost of ghosts) {
      seen.add(ghost.id);
      const existing = ghostMarkers.current.get(ghost.id);
      if (existing) {
        existing.setLatLng([ghost.lat, ghost.lng]).setIcon(ghostIcon(ghost.color, ghostMode));
      } else {
        ghostMarkers.current.set(ghost.id, L.marker([ghost.lat, ghost.lng], { icon: ghostIcon(ghost.color, ghostMode), interactive: false, zIndexOffset: 900 }).addTo(map));
      }
    }
    for (const [id, marker] of ghostMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        ghostMarkers.current.delete(id);
      }
    }
  }, [ghosts, ghostMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fix) return;
    if (shielded) {
      shieldRing.current ??= L.circle([fix.lat, fix.lng], { radius: 12, color: '#00ffff', dashArray: '4 4', weight: 2, fill: false }).addTo(map);
      shieldRing.current.setLatLng([fix.lat, fix.lng]);
    } else {
      shieldRing.current?.remove();
      shieldRing.current = null;
    }
  }, [shielded, fix]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (homeRadiusM === null || !start) {
      homeRing.current?.remove();
      homeLine.current?.remove();
      homeRing.current = null;
      homeLine.current = null;
      return;
    }
    const home: [number, number] = [start.lat, start.lng];
    homeRing.current ??= L.circle(home, { radius: homeRadiusM, color: '#ff0000', dashArray: '6 6', weight: 3, fillColor: '#ff0000', fillOpacity: 0.15 }).addTo(map);
    homeRing.current.setLatLng(home).setRadius(homeRadiusM);
    if (fix) {
      const path: [number, number][] = [[fix.lat, fix.lng], home];
      homeLine.current ??= L.polyline(path, { color: '#ff0000', dashArray: '8 8', weight: 3, opacity: 0.9 }).addTo(map);
      homeLine.current.setLatLngs(path);
    }
  }, [homeRadiusM, start, fix]);

  return (
    <div className={`relative h-full w-full theme-${theme}`}>
      <div ref={containerRef} className="h-full w-full arcade-map" />
      {dimmed && <div className="absolute inset-0 bg-black/70 z-[400] pointer-events-none" />}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { boundsOf, createDarkMap, pelletIcon, startIcon } from '../lib/leaflet';
import type { LatLng, Pellet } from '../lib/types';

export type MapMode = 'idle' | 'setStart' | 'addPellet';

interface Props {
  pellets: readonly Pellet[];
  start: LatLng | null;
  selectedId: string | null;
  mode: MapMode;
  onMapClick: (latlng: LatLng) => void;
  onSelect: (id: string) => void;
}

export default function AdminMap({ pellets, start, selectedId, mode, onMapClick, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef(new Map<string, { marker: L.Marker; ring: L.Circle }>());
  const startMarker = useRef<L.Marker | null>(null);
  const fitted = useRef(false);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = createDarkMap(containerRef.current, { center: [56.0, 10.5], zoom: 7 });
    map.on('click', e => clickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const pellet of pellets) {
      seen.add(pellet._id);
      const selected = pellet._id === selectedId;
      const existing = layers.current.get(pellet._id);
      const pos: [number, number] = [pellet.lat, pellet.lng];
      if (existing) {
        existing.marker.setLatLng(pos).setIcon(pelletIcon(pellet, selected ? 'glow-maze' : ''));
        existing.ring.setLatLng(pos).setRadius(pellet.radiusM).setStyle({ color: selected ? '#ffe600' : '#2121ff' });
      } else {
        const marker = L.marker(pos, { icon: pelletIcon(pellet, selected ? 'glow-maze' : '') }).addTo(map);
        marker.on('click', () => selectRef.current(pellet._id));
        const ring = L.circle(pos, { radius: pellet.radiusM, color: selected ? '#ffe600' : '#2121ff', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
        layers.current.set(pellet._id, { marker, ring });
      }
    }
    for (const [id, layer] of layers.current) {
      if (!seen.has(id)) {
        layer.marker.remove();
        layer.ring.remove();
        layers.current.delete(id);
      }
    }
    if (!fitted.current) {
      const bounds = boundsOf([...pellets, ...(start ? [start] : [])]);
      if (bounds) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
        fitted.current = true;
      }
    }
  }, [pellets, selectedId, start]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!start) {
      startMarker.current?.remove();
      startMarker.current = null;
      return;
    }
    startMarker.current ??= L.marker([start.lat, start.lng], { icon: startIcon(), interactive: false }).addTo(map);
    startMarker.current.setLatLng([start.lat, start.lng]);
    if (!fitted.current && pellets.length === 0) {
      map.setView([start.lat, start.lng], 16);
      fitted.current = true;
    }
  }, [start, pellets.length]);

  // The cursor class lives on a wrapper: Leaflet adds its own classes to the
  // map element, and a changing React className on that element would wipe them.
  return (
    <div className={`h-full w-full ${mode !== 'idle' ? 'cursor-crosshair' : ''}`}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

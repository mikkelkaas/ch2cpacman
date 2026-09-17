import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { boundsOf, createPlainMap, plainPelletIcon, plainStartIcon } from '../lib/leaflet';
import type { LatLng, Pellet } from '../lib/types';

export type MapMode = 'idle' | 'setStart';

interface Props {
  pellets: readonly Pellet[];
  start: LatLng | null;
  selectedId: string | null;
  mode: MapMode;
  /** A click on empty map: adds a pellet, or places the start while armed. */
  onMapClick: (latlng: LatLng) => void;
  onSelect: (id: string) => void;
  /** A pellet was dragged and dropped here. */
  onMovePellet: (id: string, latlng: LatLng) => void;
}

interface PelletLayer {
  marker: L.Marker;
  ring: L.Circle;
}

export default function AdminMap({ pellets, start, selectedId, mode, onMapClick, onSelect, onMovePellet }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef(new Map<string, PelletLayer>());
  const startMarker = useRef<L.Marker | null>(null);
  const dragging = useRef(new Set<string>());
  const fitted = useRef(false);
  const handlers = useRef({ onMapClick, onSelect, onMovePellet });
  handlers.current = { onMapClick, onSelect, onMovePellet };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = createPlainMap(containerRef.current, { center: [56.0, 10.5], zoom: 7 });
    map.on('click', e => handlers.current.onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }));
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
      const pos: [number, number] = [pellet.lat, pellet.lng];
      const existing = layers.current.get(pellet._id);
      if (existing) {
        // Leave a marker mid-drag alone; its dragend writes the new position.
        if (!dragging.current.has(pellet._id)) existing.marker.setLatLng(pos);
        existing.marker.setIcon(plainPelletIcon(pellet, selected));
        existing.ring.setLatLng(existing.marker.getLatLng()).setRadius(pellet.radiusM).setStyle({ color: selected ? '#f59e0b' : '#2563eb' });
        continue;
      }
      const marker = L.marker(pos, { icon: plainPelletIcon(pellet, selected), draggable: true, autoPan: true });
      const ring = L.circle(pos, { radius: pellet.radiusM, color: selected ? '#f59e0b' : '#2563eb', weight: 1, fillOpacity: 0.1, interactive: false });
      marker.on('click', () => handlers.current.onSelect(pellet._id));
      marker.on('dragstart', () => dragging.current.add(pellet._id));
      marker.on('drag', () => ring.setLatLng(marker.getLatLng()));
      marker.on('dragend', () => {
        dragging.current.delete(pellet._id);
        const { lat, lng } = marker.getLatLng();
        handlers.current.onMovePellet(pellet._id, { lat, lng });
      });
      marker.addTo(map);
      ring.addTo(map);
      layers.current.set(pellet._id, { marker, ring });
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
    startMarker.current ??= L.marker([start.lat, start.lng], { icon: plainStartIcon(), interactive: false }).addTo(map);
    startMarker.current.setLatLng([start.lat, start.lng]);
    if (!fitted.current && pellets.length === 0) {
      map.setView([start.lat, start.lng], 16);
      fitted.current = true;
    }
  }, [start, pellets.length]);

  // The cursor class lives on a wrapper: Leaflet adds its own classes to the
  // map element, and a changing React className on that element would wipe them.
  return (
    <div className={`h-full w-full ${mode === 'setStart' ? 'cursor-crosshair' : ''}`}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

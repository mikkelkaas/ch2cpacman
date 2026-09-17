import L from 'leaflet';
import type { LatLng, Pellet } from './types';

/**
 * Plain OpenStreetMap tiles, darkened in CSS (see `.dark-tiles` in styles.css).
 * The hosted dark basemaps (CARTO, Stadia) now need an API key and watermark
 * the tiles without one; OSM's own tiles need nothing and go to zoom 19.
 */
export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Runner map: OSM inverted to a night look. Callers give the container the `arcade-map` class. */
export function createDarkMap(container: HTMLElement, options: L.MapOptions = {}): L.Map {
  const map = L.map(container, { zoomControl: true, attributionControl: true, ...options });
  L.tileLayer(OSM_TILES, { attribution: TILE_ATTRIBUTION, maxZoom: 19, className: 'dark-tiles' }).addTo(map);
  return map;
}

/** Admin map: ordinary OSM, no theme. */
export function createPlainMap(container: HTMLElement, options: L.MapOptions = {}): L.Map {
  const map = L.map(container, { zoomControl: true, attributionControl: true, ...options });
  L.tileLayer(OSM_TILES, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  return map;
}

export const POWER_PELLET_POINTS = 3;

/** Dot diameter in px: small dots for 1 point, growing with value. */
export function pelletSizePx(points: number): number {
  return Math.min(34, 12 + points * 4);
}

export function pelletIcon(pellet: Pellet, extraClass = ''): L.DivIcon {
  const size = pelletSizePx(pellet.points);
  const power = pellet.points >= POWER_PELLET_POINTS ? 'power' : '';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="pellet-dot ${power} ${extraClass}" style="width:${size}px;height:${size}px"><span class="pellet-label">${pellet.points}</span></div>`,
  });
}

/** Admin pellet: a plain blue disc with the point value, no glow. */
export function plainPelletIcon(pellet: Pellet, selected: boolean): L.DivIcon {
  const size = 28;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="plain-pellet ${selected ? 'selected' : ''}">${pellet.points}</div>`,
  });
}

export function plainStartIcon(): L.DivIcon {
  return L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9], html: '<div class="plain-start" title="Start"></div>' });
}

export function startIcon(): L.DivIcon {
  return L.divIcon({ className: '', iconSize: [14, 14], iconAnchor: [7, 7], html: '<div class="start-square"></div>' });
}

/** Yellow Pac-Man facing `headingDeg` (0 = north). The mouth is on the +x side before rotation. */
export function pacmanIcon(headingDeg: number): L.DivIcon {
  const rot = headingDeg - 90;
  return L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<svg class="pacman" viewBox="0 0 100 100" width="30" height="30" style="transform:rotate(${rot}deg)">
      <path d="M50 50 L95 22 A50 50 0 1 0 95 78 Z" fill="#ffe600"/>
    </svg>`,
  });
}

export function boundsOf(points: readonly LatLng[]): L.LatLngBounds | null {
  if (points.length === 0) return null;
  return L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
}

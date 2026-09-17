import L from 'leaflet';
import type { LatLng, Pellet } from './types';

export const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function createDarkMap(container: HTMLElement, options: L.MapOptions = {}): L.Map {
  const map = L.map(container, { zoomControl: true, attributionControl: true, ...options });
  L.tileLayer(DARK_TILES, { attribution: TILE_ATTRIBUTION, subdomains: 'abcd', maxZoom: 20 }).addTo(map);
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

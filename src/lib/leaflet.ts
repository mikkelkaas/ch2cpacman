import L from 'leaflet';
import { storage } from './storage';
import type { AdminBaseLayer } from './storage';
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

/** Esri's aerial imagery: worldwide, no API key, attribution required, often years old. */
export const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const SATELLITE_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

/**
 * The Danish spring orthophoto from Dataforsyningen: flown every year, sharp
 * down to zoom 20, Denmark only. The token is a free Dataforsyningen one and
 * is meant to sit in client code.
 */
const DATAFORSYNINGEN_TOKEN = '42197a8167a47e19a7920e9cf36603ea';
export const DK_ORTHO_TILES =
  'https://api.dataforsyningen.dk/orto_foraar_webm_DAF?service=WMTS&request=GetTile&version=1.0.0&layer=orto_foraar_webm&style=default' +
  `&format=image/jpeg&tileMatrixSet=DFD_GoogleMapsCompatible&tileMatrix={z}&tileRow={y}&tileCol={x}&token=${DATAFORSYNINGEN_TOKEN}`;
export const DK_ORTHO_ATTRIBUTION = 'Ortofoto &copy; <a href="https://dataforsyningen.dk">Klimadatastyrelsen</a>';

/**
 * Admin map: ordinary OSM, no theme, with a toggle to aerial photos for
 * placing dots on paths and clearings the map does not show. The choice is
 * remembered in this browser.
 */
export function createPlainMap(container: HTMLElement, options: L.MapOptions = {}): L.Map {
  const map = L.map(container, { zoomControl: true, attributionControl: true, ...options });
  const layers: Record<AdminBaseLayer, L.TileLayer> = {
    map: L.tileLayer(OSM_TILES, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }),
    aerial: L.tileLayer(DK_ORTHO_TILES, { attribution: DK_ORTHO_ATTRIBUTION, maxZoom: 20 }),
    satellite: L.tileLayer(SATELLITE_TILES, { attribution: SATELLITE_ATTRIBUTION, maxZoom: 19 }),
  };
  const labels: Record<AdminBaseLayer, string> = { map: 'Kort', aerial: 'Luftfoto (DK)', satellite: 'Satellit (verden)' };
  layers[storage.getAdminBaseLayer()].addTo(map);
  const byLabel = Object.fromEntries((Object.keys(layers) as AdminBaseLayer[]).map(k => [labels[k], layers[k]]));
  L.control.layers(byLabel, undefined, { position: 'topright' }).addTo(map);
  map.on('baselayerchange', e => {
    const key = (Object.keys(layers) as AdminBaseLayer[]).find(k => layers[k] === e.layer);
    if (key) storage.setAdminBaseLayer(key);
  });
  return map;
}

/** Dot diameter in px: small dots for 1 point, growing with value; power pellets are big. */
export function pelletSizePx(pellet: Pellet): number {
  if (pellet.kind === 'power') return 34;
  return Math.min(30, 12 + pellet.points * 4);
}

export function pelletIcon(pellet: Pellet, extraClass = ''): L.DivIcon {
  const size = pelletSizePx(pellet);
  const kind = pellet.kind ?? 'normal';
  const label = kind === 'double' ? `×2 ${pellet.points}` : `${pellet.points}`;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="pellet-dot kind-${kind} ${extraClass}" style="width:${size}px;height:${size}px"><span class="pellet-label">${label}</span></div>`,
  });
}

/** Classic ghost sprite. Blue while frightened, flashing white just before it wears off. */
/** `angry`: at top speed, a red glow so the runner can see which ghost to fear. */
export function ghostIcon(color: string, mode: 'normal' | 'frightened' | 'flashing', angry = false): L.DivIcon {
  const fill = mode === 'normal' ? color : mode === 'frightened' ? '#2121ff' : '#ffffff';
  const eyes = mode === 'normal'
    ? '<circle cx="36" cy="42" r="9" fill="#fff"/><circle cx="64" cy="42" r="9" fill="#fff"/><circle cx="39" cy="44" r="4" fill="#2121ff"/><circle cx="67" cy="44" r="4" fill="#2121ff"/>'
    : '<circle cx="36" cy="44" r="4" fill="#ffb8ae"/><circle cx="64" cy="44" r="4" fill="#ffb8ae"/><path d="M28 66 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6" stroke="#ffb8ae" stroke-width="4" fill="none"/>';
  return L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<svg class="ghost ${mode}${angry && mode === 'normal' ? ' angry' : ''}" viewBox="0 0 100 100" width="30" height="30">
      <path d="M10 95 V50 A40 40 0 0 1 90 50 V95 L78 82 L66 95 L54 82 L42 95 L30 82 L18 95 Z" fill="${fill}" stroke="#000" stroke-width="4"/>${eyes}</svg>`,
  });
}

/** Admin pellet: a plain blue disc with the point value, no glow. */
export function plainPelletIcon(pellet: Pellet, selected: boolean): L.DivIcon {
  const size = 28;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="plain-pellet ${selected ? 'selected' : ''} kind-${pellet.kind ?? 'normal'}">${pellet.kind === 'double' ? '×2' : pellet.points}</div>`,
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
      <path d="M50 50 L95 22 A50 50 0 1 0 95 78 Z" fill="#ffe600" stroke="#000" stroke-width="5"/>
    </svg>`,
  });
}

export function boundsOf(points: readonly LatLng[]): L.LatLngBounds | null {
  if (points.length === 0) return null;
  return L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
}

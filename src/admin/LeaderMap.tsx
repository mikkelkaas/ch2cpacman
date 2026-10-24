import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { da } from '../i18n/da';
import type { TeamPosition } from '../lib/leader';
import { boundsOf, createPlainMap, plainPelletIcon, plainStartIcon } from '../lib/leaflet';
import type { LatLng, Pellet } from '../lib/types';

interface Props {
  pellets: readonly Pellet[];
  start: LatLng | null;
  positions: readonly TeamPosition[];
  /** Time left, or that the team is on its way home, by team id. */
  clocks: ReadonlyMap<string, string>;
  showDots: boolean;
}

/** A team's marker: a dot in its colour with the name beside it, faded when the phone has gone quiet. */
function teamIcon(position: TeamPosition, clock: string | undefined): L.DivIcon {
  const pin = document.createElement('div');
  pin.className = `team-pin${position.stale ? ' stale' : ''}`;
  const dot = document.createElement('span');
  dot.className = 'team-pin-dot';
  dot.style.background = position.team.color;
  const name = document.createElement('span');
  name.className = 'team-pin-name';
  // textContent, not html: team names are typed in by people.
  name.textContent = [position.team.name, clock, position.stale ? da.positionAge(position.ageMs) : null].filter(Boolean).join(' · ');
  pin.append(dot, name);
  return L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9], html: pin });
}

/** The postmandskab's overview: where every running team's phone is, over the dots and the start. */
export default function LeaderMap({ pellets, start, positions, clocks, showDots }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dotLayer = useRef(L.layerGroup());
  const startLayer = useRef(L.layerGroup());
  const teamLayer = useRef(L.layerGroup());
  // The view is set once, from the course: teams moving should not pull the map around.
  const fitted = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = createPlainMap(containerRef.current, { center: [56.0, 10.5], zoom: 7 });
    startLayer.current.addTo(map);
    teamLayer.current.addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    dotLayer.current.clearLayers();
    startLayer.current.clearLayers();
    for (const pellet of pellets) {
      L.marker([pellet.lat, pellet.lng], { icon: plainPelletIcon(pellet, false), interactive: false, keyboard: false }).addTo(dotLayer.current);
    }
    if (start) L.marker([start.lat, start.lng], { icon: plainStartIcon(), interactive: false, keyboard: false }).addTo(startLayer.current);
    if (!fitted.current) {
      const bounds = boundsOf([...pellets, ...(start ? [start] : [])]);
      if (bounds) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
        fitted.current = true;
      }
    }
  }, [pellets, start]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (showDots) dotLayer.current.addTo(map);
    else dotLayer.current.remove();
  }, [showDots]);

  useEffect(() => {
    teamLayer.current.clearLayers();
    // Live teams on top of stale ones.
    for (const p of [...positions].sort((a, b) => Number(b.stale) - Number(a.stale))) {
      L.marker([p.lat, p.lng], { icon: teamIcon(p, clocks.get(p.team._id)), interactive: false, keyboard: false, zIndexOffset: p.stale ? 500 : 1000 }).addTo(teamLayer.current);
    }
  }, [positions, clocks]);

  return <div ref={containerRef} className="h-full w-full" />;
}

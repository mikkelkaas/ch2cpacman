import { useEffect, useState } from 'react';
import RunnerApp from './runner/RunnerApp';
import AdminApp from './admin/AdminApp';
import GamesPage from './admin/GamesPage';
import PrintPage from './admin/PrintPage';

type Route =
  | { kind: 'runner'; joinCode: string | null }
  | { kind: 'games' }
  | { kind: 'admin'; gameId: string }
  | { kind: 'print'; gameId: string };

function routeFromHash(): Route {
  const hash = window.location.hash;
  const join = hash.match(/^#\/join\/([A-Za-z0-9]+)/);
  if (join) return { kind: 'runner', joinCode: join[1].toUpperCase() };
  const admin = hash.match(/^#\/admin(?:\/([^/]+))?(\/print)?/);
  if (!admin) return { kind: 'runner', joinCode: null };
  if (!admin[1]) return { kind: 'games' };
  const gameId = decodeURIComponent(admin[1]);
  return admin[2] ? { kind: 'print', gameId } : { kind: 'admin', gameId };
}

/** Address a phone opens to join a team straight away. */
export function joinUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/join/${code}`;
}

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(routeFromHash);
  useEffect(() => {
    const onChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  if (route.kind === 'admin') return <AdminApp key={route.gameId} gameId={route.gameId} />;
  if (route.kind === 'print') return <PrintPage gameId={route.gameId} />;
  if (route.kind === 'games') return <GamesPage />;
  return <RunnerApp joinCode={route.joinCode} />;
}

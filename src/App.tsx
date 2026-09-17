import { useEffect, useState } from 'react';
import RunnerApp from './runner/RunnerApp';
import AdminApp from './admin/AdminApp';
import GamesPage from './admin/GamesPage';

type Route = { kind: 'runner' } | { kind: 'games' } | { kind: 'admin'; gameId: string };

function routeFromHash(): Route {
  const match = window.location.hash.match(/^#\/admin(?:\/([^/]+))?/);
  if (!match) return { kind: 'runner' };
  return match[1] ? { kind: 'admin', gameId: decodeURIComponent(match[1]) } : { kind: 'games' };
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
  if (route.kind === 'games') return <GamesPage />;
  return <RunnerApp />;
}

import { useEffect, useState } from 'react';
import RunnerApp from './runner/RunnerApp';
import AdminApp from './admin/AdminApp';

type Route = 'runner' | 'admin';

function routeFromHash(): Route {
  return window.location.hash.startsWith('#/admin') ? 'admin' : 'runner';
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
  return route === 'admin' ? <AdminApp /> : <RunnerApp />;
}

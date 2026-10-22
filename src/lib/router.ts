import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'today' }
  | { name: 'clients' }
  | { name: 'client'; id: string }
  | { name: 'accounts' }
  | { name: 'account'; id: string }
  | { name: 'billing'; view?: 'balances' | 'history' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const [, section, id] = path.split('/');
  switch (section) {
    case 'clientes':
      return id ? { name: 'client', id: decodeURIComponent(id) } : { name: 'clients' };
    case 'cuentas':
      return id ? { name: 'account', id: decodeURIComponent(id) } : { name: 'accounts' };
    case 'cobros':
      return { name: 'billing', view: id === 'movimientos' ? 'history' : 'balances' };
    default:
      return { name: 'today' };
  }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'today':
      return '#/';
    case 'clients':
      return '#/clientes';
    case 'client':
      return `#/clientes/${encodeURIComponent(route.id)}`;
    case 'accounts':
      return '#/cuentas';
    case 'account':
      return `#/cuentas/${encodeURIComponent(route.id)}`;
    case 'billing':
      return route.view === 'history' ? '#/cobros/movimientos' : '#/cobros';
  }
}

export function navigate(route: Route) {
  window.location.hash = routeHref(route);
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  return parseRoute(hash);
}

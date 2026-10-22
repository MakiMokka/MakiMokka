import { House, Tv, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { Route } from '../lib/router';

export type Destination = 'today' | 'clients' | 'accounts' | 'billing';

export const destinations: { id: Destination; label: string; icon: LucideIcon; route: Route }[] = [
  { id: 'today', label: 'Hoy', icon: House, route: { name: 'today' } },
  { id: 'clients', label: 'Clientes', icon: Users, route: { name: 'clients' } },
  { id: 'accounts', label: 'Cuentas', icon: Tv, route: { name: 'accounts' } },
  { id: 'billing', label: 'Cobros', icon: Wallet, route: { name: 'billing' } },
];

export function destinationOf(route: Route): Destination {
  switch (route.name) {
    case 'client':
    case 'clients':
      return 'clients';
    case 'account':
    case 'accounts':
      return 'accounts';
    case 'billing':
      return 'billing';
    default:
      return 'today';
  }
}

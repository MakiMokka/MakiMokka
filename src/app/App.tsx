import { CircleAlert, Download, Play, RefreshCw, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { emptyData } from '../domain/types';
import { pendingAssignments } from '../domain/selectors';
import { AccountDetailScreen } from '../features/accounts/AccountDetailScreen';
import { AccountsScreen } from '../features/accounts/AccountsScreen';
import { BillingScreen } from '../features/billing/BillingScreen';
import { ClientDetailScreen } from '../features/clients/ClientDetailScreen';
import { ClientsScreen } from '../features/clients/ClientsScreen';
import { useFlows } from '../features/flows/FlowProvider';
import { downloadJSON } from '../features/flows/SettingsSheet';
import { TodayScreen } from '../features/today/TodayScreen';
import { routeHref, useRoute, type Route } from '../lib/router';
import { useStore } from '../store/StoreProvider';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Skeleton } from '../ui/Layout';
import { destinationOf, destinations } from './navigation';

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'today':
      return <TodayScreen />;
    case 'clients':
      return <ClientsScreen />;
    case 'client':
      return <ClientDetailScreen id={route.id} />;
    case 'accounts':
      return <AccountsScreen />;
    case 'account':
      return <AccountDetailScreen id={route.id} />;
    case 'billing':
      return <BillingScreen view={route.view ?? 'balances'} />;
  }
}

function Navigation({ route, variant }: { route: Route; variant: 'sidebar' | 'tabbar' }) {
  const { data } = useStore();
  const current = destinationOf(route);
  const pending = pendingAssignments(data).length;
  return (
    <ul className={`${variant}__list`}>
      {destinations.map((d) => {
        const Icon = d.icon;
        const active = d.id === current;
        const badge = d.id === 'today' && pending > 0 ? pending : null;
        return (
          <li key={d.id}>
            <a
              href={routeHref(d.route)}
              className={`${variant}__item${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className={`${variant}__icon`}>
                <Icon size={variant === 'tabbar' ? 24 : 20} aria-hidden />
                {badge && (
                  <span className="nav-badge num" aria-label={`${badge} por asignar`}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span className={`${variant}__label`}>{d.label}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function LoadError({ message, raw }: { message: string; raw: string | null }) {
  const { retry, replaceAll } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="state-screen" role="alert">
      <span className="state-screen__icon state-screen__icon--coral">
        <CircleAlert size={28} aria-hidden />
      </span>
      <h1 className="state-screen__title">No se pudieron cargar tus datos</h1>
      <p className="state-screen__message">{message}</p>
      <div className="state-screen__actions">
        <Button variant="primary" icon={RefreshCw} onClick={retry}>
          Reintentar
        </Button>
        {raw && (
          <Button variant="secondary" icon={Download} onClick={() => downloadJSON(raw, 'poptv-datos-recuperados.json')}>
            Descargar datos guardados
          </Button>
        )}
        <Button variant="tinted" onClick={() => setConfirmReset(true)}>
          Empezar sin datos
        </Button>
      </div>
      <ConfirmDialog
        open={confirmReset}
        title="¿Empezar sin datos?"
        message="Se reemplazarán los datos guardados en este navegador. Descarga primero una copia si quieres conservarlos."
        confirmLabel="Empezar sin datos"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          replaceAll(emptyData());
        }}
      />
    </div>
  );
}

function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="visually-hidden">Cargando datos…</span>
      <div className="loading__header">
        <div className="skeleton__line skeleton__line--title" />
      </div>
      <div className="metrics metrics--skeleton" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="metric">
            <Skeleton lines={2} />
          </div>
        ))}
      </div>
      <div className="surface surface--padded">
        <Skeleton lines={4} />
      </div>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const { load } = useStore();
  const flows = useFlows();
  const mainRef = useRef<HTMLElement>(null);
  const routeKey = routeHref(route);
  const first = useRef(true);

  // Al cambiar de pantalla: volver arriba y mover el foco al título para lectores de pantalla.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.querySelector<HTMLElement>('[data-page-title]')?.focus({ preventScroll: true });
  }, [routeKey]);

  return (
    <div className="app">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <nav className="sidebar" aria-label="Secciones">
        <div className="sidebar__brand">
          <span className="brand-mark" aria-hidden>
            <Play size={14} />
          </span>
          <span className="sidebar__brand-text">PopTV</span>
        </div>
        <Navigation route={route} variant="sidebar" />
        <button type="button" className="sidebar__item sidebar__footer" onClick={() => flows.open({ type: 'settings' })}>
          <span className="sidebar__icon">
            <Settings size={20} aria-hidden />
          </span>
          <span className="sidebar__label">Preferencias</span>
        </button>
      </nav>
      <main id="contenido" ref={mainRef} className="main" tabIndex={-1}>
        <div className="main__inner">
          {load.status === 'loading' && <Loading />}
          {load.status === 'error' && <LoadError message={load.message} raw={load.raw} />}
          {load.status === 'ready' && <Screen route={route} />}
        </div>
      </main>
      <nav className="tabbar" aria-label="Secciones">
        <Navigation route={route} variant="tabbar" />
      </nav>
    </div>
  );
}

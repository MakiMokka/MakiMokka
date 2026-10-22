import { Plus, SearchX, Tv } from 'lucide-react';
import { useMemo, useState } from 'react';
import { accountFilterLabels, accountRows, matchesAccountFilter, matchesQuery, type AccountFilter } from '../../domain/selectors';
import { formatDaysRemaining } from '../../domain/status';
import { formatCredits, formatDate, formatMoney, maskUsername } from '../../lib/format';
import { useToday } from '../../lib/hooks';
import { navigate, routeHref } from '../../lib/router';
import { useStore } from '../../store/StoreProvider';
import { Button } from '../../ui/Button';
import { FilterChips, SearchField } from '../../ui/Controls';
import { EmptyState, PageHeader } from '../../ui/Layout';
import { PrimaryAction } from '../../ui/PrimaryAction';
import { AssignmentBadge, ExpiryBadge } from '../../ui/StatusBadge';
import { useFlows } from '../flows/FlowProvider';

const FILTERS: AccountFilter[] = ['all', 'active', 'soon', 'expired', 'pending'];

export function AccountsScreen() {
  const { data } = useStore();
  const flows = useFlows();
  const today = useToday();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AccountFilter>('all');

  const all = useMemo(() => accountRows(data, today), [data, today]);
  const searched = all.filter((r) => matchesQuery(query, r.client.name, r.account.alias, r.account.username));
  const rows = searched.filter((r) => matchesAccountFilter(r, filter));
  const hasClients = data.clients.some((c) => !c.archived);

  return (
    <>
      <PageHeader
        title="Cuentas"
        actions={
          <PrimaryAction
            label="Nueva cuenta"
            icon={Plus}
            onClick={() => flows.open(hasClients ? { type: 'account' } : { type: 'client' })}
          />
        }
      >
        {all.length > 0 && (
          <div className="toolbar">
            <SearchField value={query} onChange={setQuery} placeholder="Buscar por cliente, alias o usuario" label="Buscar cuentas" />
            <FilterChips
              label="Filtrar cuentas"
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({
                value: f,
                label: accountFilterLabels[f],
                count: searched.filter((r) => matchesAccountFilter(r, f)).length,
              }))}
            />
          </div>
        )}
      </PageHeader>

      {all.length === 0 ? (
        <EmptyState
          icon={Tv}
          title="Sin cuentas"
          message={
            hasClients
              ? 'Registra las cuentas del portal de PopTV de tus clientes.'
              : 'Primero agrega un cliente; después podrás registrar sus cuentas.'
          }
          action={
            <Button variant="primary" icon={Plus} onClick={() => flows.open(hasClients ? { type: 'account' } : { type: 'client' })}>
              {hasClients ? 'Agregar cuenta' : 'Agregar cliente'}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          message={
            query
              ? `Ninguna cuenta coincide con “${query}” en “${accountFilterLabels[filter]}”.`
              : `No hay cuentas en “${accountFilterLabels[filter]}”.`
          }
          action={
            <Button
              variant="tinted"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Ver todas las cuentas
            </Button>
          }
        />
      ) : (
        <div className="surface surface--wide">
          <table className="table table--accounts">
            <caption className="visually-hidden">Cuentas ordenadas por vencimiento más próximo</caption>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Cuenta</th>
                <th scope="col">Usuario</th>
                <th scope="col">Plan</th>
                <th scope="col" aria-sort="ascending">
                  Vencimiento
                </th>
                <th scope="col" className="col-num">
                  Días
                </th>
                <th scope="col" className="col-num">
                  Últimos créditos
                </th>
                <th scope="col">Estado</th>
                <th scope="col" className="col-num">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.account.id} className="table__row--link" onClick={() => navigate({ name: 'account', id: r.account.id })}>
                  <td data-label="Cliente" className="cell-secondary-title">
                    {r.client.name}
                  </td>
                  <td data-label="Cuenta" className="cell-primary">
                    <a href={routeHref({ name: 'account', id: r.account.id })} onClick={(e) => e.stopPropagation()} className="cell-title">
                      {r.account.alias}
                    </a>
                  </td>
                  <td data-label="Usuario" className="mono">
                    {maskUsername(r.account.username)}
                  </td>
                  <td data-label="Plan">{r.account.plan || <span className="muted">—</span>}</td>
                  <td data-label="Vence" className="num">
                    {formatDate(r.account.expiresAt, today)}
                  </td>
                  <td data-label="Días" className="col-num num">
                    {formatDaysRemaining(r.status.days)}
                  </td>
                  <td data-label="Últimos créditos" className="col-num num">
                    {r.lastAssigned ? formatCredits(r.lastAssigned.credits) : '—'}
                  </td>
                  <td data-label="Estado" className="cell-badges">
                    <ExpiryBadge status={r.status} size="sm" />
                    {r.pendingCount > 0 && <AssignmentBadge status="pending" size="sm" />}
                  </td>
                  <td data-label="Saldo" className="col-num num cell-amount">
                    {r.outstanding > 0 ? formatMoney(r.outstanding) : <span className="muted">{formatMoney(0)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

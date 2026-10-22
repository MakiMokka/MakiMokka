import { ChevronRight, SearchX, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { clientRows, matchesQuery } from '../../domain/selectors';
import { formatMoney } from '../../lib/format';
import { navigate, routeHref } from '../../lib/router';
import { useStore } from '../../store/StoreProvider';
import { Button } from '../../ui/Button';
import { FilterChips, SearchField } from '../../ui/Controls';
import { EmptyState, PageHeader } from '../../ui/Layout';
import { PrimaryAction } from '../../ui/PrimaryAction';
import { PaymentBadge, StatusBadge } from '../../ui/StatusBadge';
import { useFlows } from '../flows/FlowProvider';
import { Archive, CircleCheck } from 'lucide-react';

type Scope = 'active' | 'archived' | 'all';

export function ClientsScreen() {
  const { data } = useStore();
  const flows = useFlows();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('active');

  const all = useMemo(() => clientRows(data, { includeArchived: true }), [data]);
  const counts = {
    active: all.filter((r) => !r.client.archived).length,
    archived: all.filter((r) => r.client.archived).length,
    all: all.length,
  };
  const rows = all.filter(
    (r) =>
      (scope === 'all' || (scope === 'archived') === r.client.archived) &&
      matchesQuery(
        query,
        r.client.name,
        r.client.phone,
        r.client.email,
        ...data.accounts.filter((a) => a.clientId === r.client.id).flatMap((a) => [a.alias, a.username]),
      ),
  );

  return (
    <>
      <PageHeader
        title="Clientes"
        actions={<PrimaryAction label="Nuevo cliente" icon={UserPlus} onClick={() => flows.open({ type: 'client' })} />}
      >
        {all.length > 0 && (
          <div className="toolbar">
            <SearchField value={query} onChange={setQuery} placeholder="Buscar por nombre, teléfono o cuenta" label="Buscar clientes" />
            <FilterChips
              label="Mostrar"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'active', label: 'Activos', count: counts.active },
                { value: 'archived', label: 'Archivados', count: counts.archived },
                { value: 'all', label: 'Todos', count: counts.all },
              ]}
            />
          </div>
        )}
      </PageHeader>

      {all.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay clientes"
          message="Agrega un cliente con su precio habitual por crédito para empezar a registrar servicios."
          action={
            <Button variant="primary" icon={UserPlus} onClick={() => flows.open({ type: 'client' })}>
              Agregar cliente
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          message={query ? `Ningún cliente coincide con “${query}”.` : 'No hay clientes en esta vista.'}
        />
      ) : (
        <div className="surface">
          <table className="table table--clients">
            <caption className="visually-hidden">Clientes</caption>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col" className="col-num">
                  Cuentas
                </th>
                <th scope="col" className="col-num">
                  Precio por crédito
                </th>
                <th scope="col" className="col-num">
                  Saldo
                </th>
                <th scope="col">Pago</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="visually-hidden">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ client, summary, accountCount, pendingCount }) => (
                <tr key={client.id} className="table__row--link" onClick={() => navigate({ name: 'client', id: client.id })}>
                  <td data-label="Cliente" className="cell-primary">
                    <a href={routeHref({ name: 'client', id: client.id })} onClick={(e) => e.stopPropagation()} className="cell-title">
                      {client.name}
                    </a>
                    <span className="cell-sub num">
                      {client.phone}
                      {pendingCount > 0 && ` · ${pendingCount} por asignar`}
                    </span>
                  </td>
                  <td data-label="Cuentas" className="col-num num">
                    {accountCount}
                  </td>
                  <td data-label="Precio por crédito" className="col-num num">
                    {formatMoney(client.pricePerCredit)}
                  </td>
                  <td data-label="Saldo" className="col-num num cell-amount">
                    {formatMoney(summary.balance)}
                  </td>
                  <td data-label="Pago">
                    {summary.paymentState ? (
                      <PaymentBadge state={summary.paymentState} size="sm" />
                    ) : (
                      <span className="muted">Sin movimientos</span>
                    )}
                  </td>
                  <td data-label="Estado">
                    {client.archived ? (
                      <StatusBadge tone="neutral" icon={Archive} label="Archivado" size="sm" />
                    ) : (
                      <StatusBadge tone="green" icon={CircleCheck} label="Activo" size="sm" />
                    )}
                  </td>
                  <td className="cell-chevron" aria-hidden>
                    <ChevronRight size={18} />
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

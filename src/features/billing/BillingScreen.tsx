import { ChevronRight, CircleCheck, Hourglass, Receipt, SearchX, Users, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { isSameMonth } from '../../domain/dates';
import { movementTypeLabels } from '../../domain/labels';
import { ledgerRows, paymentsInMonth, totalReceivable } from '../../domain/ledger';
import { clientRows, matchesQuery, pendingAssignments } from '../../domain/selectors';
import type { MovementType } from '../../domain/types';
import { formatDate, formatMoney } from '../../lib/format';
import { useToday } from '../../lib/hooks';
import { navigate, routeHref, type Route } from '../../lib/router';
import { useStore } from '../../store/StoreProvider';
import { Button } from '../../ui/Button';
import { FilterChips, SearchField, Segmented } from '../../ui/Controls';
import { EmptyState, MetricStrip, PageHeader } from '../../ui/Layout';
import { PrimaryAction } from '../../ui/PrimaryAction';
import { PaymentBadge } from '../../ui/StatusBadge';
import { useFlows } from '../flows/FlowProvider';
import { MovementsTable } from '../shared/MovementsTable';

type View = 'balances' | 'history';
type BalanceFilter = 'owing' | 'all';
type TypeFilter = 'all' | MovementType;

export function BillingScreen({ view }: { view: View }) {
  const { data } = useStore();
  const flows = useFlows();
  const today = useToday();
  const [query, setQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('owing');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const stats = useMemo(() => {
    const clients = clientRows(data, { includeArchived: true });
    return {
      clients,
      receivable: totalReceivable(data),
      owing: clients.filter((r) => r.summary.balance > 0).length,
      monthPayments: paymentsInMonth(data, today),
      monthPaymentsCount: data.movements.filter((m) => m.type === 'payment' && isSameMonth(m.date, today)).length,
      pending: pendingAssignments(data).length,
      ledger: ledgerRows(data),
    };
  }, [data, today]);

  const setView = (v: View) => navigate({ name: 'billing', view: v } satisfies Route);

  const balanceRows = stats.clients
    .filter((r) => (balanceFilter === 'owing' ? r.summary.balance > 0 : r.summary.paymentState !== null))
    .filter((r) => matchesQuery(query, r.client.name, r.client.phone))
    .sort((a, b) => b.summary.balance - a.summary.balance);

  const movementRows = stats.ledger.filter((r) => {
    if (typeFilter !== 'all' && r.movement.type !== typeFilter) return false;
    if (!query) return true;
    const client = data.clients.find((c) => c.id === r.movement.clientId);
    const account = data.accounts.find((a) => a.id === r.movement.accountId);
    return matchesQuery(query, client?.name ?? '', account?.alias ?? '', r.movement.reference, r.movement.note);
  });

  return (
    <>
      <PageHeader
        title="Cobros y movimientos"
        actions={<PrimaryAction label="Registrar pago" icon={Wallet} onClick={() => flows.open({ type: 'payment' })} />}
      />

      <MetricStrip
        label="Resumen de cobros"
        metrics={[
          { label: 'Saldo por cobrar', value: formatMoney(stats.receivable), icon: Wallet, tone: stats.receivable > 0 ? 'coral' : 'green' },
          { label: 'Clientes con saldo', value: stats.owing, icon: Users, tone: 'blue' },
          {
            label: 'Pagos del mes',
            value: formatMoney(stats.monthPayments),
            icon: CircleCheck,
            tone: 'green',
            detail: `${stats.monthPaymentsCount} ${stats.monthPaymentsCount === 1 ? 'pago' : 'pagos'}`,
          },
          { label: 'Por asignar', value: stats.pending, icon: Hourglass, tone: 'yellow', href: routeHref({ name: 'today' }) },
        ]}
      />

      <div className="toolbar toolbar--spaced">
        <Segmented
          label="Vista"
          value={view}
          onChange={setView}
          options={[
            { value: 'balances', label: 'Saldos por cliente' },
            { value: 'history', label: 'Historial' },
          ]}
        />
        {data.movements.length > 0 && (
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={view === 'balances' ? 'Buscar cliente' : 'Buscar cliente, cuenta o referencia'}
            label={view === 'balances' ? 'Buscar cliente' : 'Buscar movimientos'}
          />
        )}
        {data.movements.length > 0 &&
          (view === 'balances' ? (
            <FilterChips
              label="Mostrar clientes"
              value={balanceFilter}
              onChange={setBalanceFilter}
              options={[
                { value: 'owing', label: 'Con saldo', count: stats.owing },
                { value: 'all', label: 'Todos con movimientos' },
              ]}
            />
          ) : (
            <FilterChips
              label="Tipo de movimiento"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'Todos' },
                ...(['charge', 'payment', 'adjustment', 'cancellation'] as MovementType[]).map((t) => ({
                  value: t,
                  label: movementTypeLabels[t],
                })),
              ]}
            />
          ))}
      </div>

      {data.movements.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin movimientos todavía"
          message="Los cargos se generan al registrar servicios; los pagos, al registrarlos aquí o al capturar el servicio."
          action={
            <Button variant="secondary" onClick={() => flows.open({ type: 'service' })}>
              Registrar servicio
            </Button>
          }
        />
      ) : view === 'balances' ? (
        balanceRows.length === 0 ? (
          query ? (
            <EmptyState icon={SearchX} title="Sin resultados" message={`Ningún cliente coincide con “${query}”.`} />
          ) : (
            <EmptyState icon={CircleCheck} title="Todo cobrado" message="Ningún cliente tiene saldo pendiente." />
          )
        ) : (
          <div className="surface">
            <table className="table table--balances">
              <caption className="visually-hidden">Saldos por cliente</caption>
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col" className="col-num">
                    Precio por crédito
                  </th>
                  <th scope="col" className="col-num">
                    Total de cargos
                  </th>
                  <th scope="col" className="col-num">
                    Total pagado
                  </th>
                  <th scope="col" className="col-num" aria-sort="descending">
                    Saldo
                  </th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="visually-hidden">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {balanceRows.map(({ client, summary }) => (
                  <tr key={client.id}>
                    <td data-label="Cliente" className="cell-primary">
                      <a className="cell-title" href={routeHref({ name: 'client', id: client.id })}>
                        {client.name}
                      </a>
                      <span className="cell-sub num">
                        {summary.lastPayment ? `Último pago ${formatDate(summary.lastPayment.date, today)}` : 'Sin pagos'}
                      </span>
                    </td>
                    <td data-label="Precio por crédito" className="col-num num">
                      {formatMoney(client.pricePerCredit)}
                    </td>
                    <td data-label="Total de cargos" className="col-num num">
                      {formatMoney(summary.totalCharges + summary.totalAdjustments)}
                    </td>
                    <td data-label="Total pagado" className="col-num num">
                      {formatMoney(summary.totalPaid)}
                    </td>
                    <td data-label="Saldo" className="col-num num cell-amount">
                      {formatMoney(summary.balance)}
                    </td>
                    <td data-label="Estado">{summary.paymentState && <PaymentBadge state={summary.paymentState} size="sm" />}</td>
                    <td className="cell-actions">
                      {summary.balance > 0 ? (
                        <Button variant="secondary" icon={Wallet} onClick={() => flows.open({ type: 'payment', clientId: client.id })}>
                          Registrar pago
                        </Button>
                      ) : (
                        <a className="text-link text-link--icon" href={routeHref({ name: 'client', id: client.id })}>
                          Ver cliente <ChevronRight size={16} aria-hidden />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : movementRows.length === 0 ? (
        <EmptyState icon={SearchX} title="Sin resultados" message="Ningún movimiento coincide con la búsqueda o el filtro." />
      ) : (
        <MovementsTable rows={movementRows} data={data} today={today} />
      )}
    </>
  );
}

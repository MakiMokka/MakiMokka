import { Ban, Receipt, SlidersHorizontal, Wallet, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { LedgerRow } from '../../domain/ledger';
import { movementTypeLabels, paymentMethodLabels } from '../../domain/labels';
import type { AppData, MovementType } from '../../domain/types';
import { formatCredits, formatDate, formatMoney } from '../../lib/format';
import { routeHref } from '../../lib/router';
import { Button } from '../../ui/Button';
import { AssignmentBadge } from '../../ui/StatusBadge';
import { useCancelService } from './useCancelService';

const typeIcons: Record<MovementType, LucideIcon> = {
  charge: Receipt,
  payment: Wallet,
  adjustment: SlidersHorizontal,
  cancellation: Ban,
};

function signedAmount(type: MovementType, amount: number) {
  if (type === 'payment' || type === 'cancellation') return `−${formatMoney(amount)}`;
  if (type === 'adjustment') return amount < 0 ? `−${formatMoney(-amount)}` : `+${formatMoney(amount)}`;
  return `+${formatMoney(amount)}`;
}

const PAGE = 50;

/** Historial de movimientos con saldo resultante; el más reciente primero. */
export function MovementsTable({
  rows,
  data,
  today,
  showClient = true,
}: {
  rows: LedgerRow[];
  data: AppData;
  today: string;
  showClient?: boolean;
}) {
  const [limit, setLimit] = useState(PAGE);
  const cancel = useCancelService();
  const ordered = [...rows].reverse();
  const visible = ordered.slice(0, limit);

  return (
    <>
      <div className="surface surface--wide">
        <table className="table table--movements">
          <caption className="visually-hidden">Historial de movimientos</caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              {showClient && <th scope="col">Cliente</th>}
              <th scope="col">Cuenta</th>
              <th scope="col">Tipo</th>
              <th scope="col" className="col-num">
                Créditos
              </th>
              <th scope="col" className="col-num">
                Precio unitario
              </th>
              <th scope="col" className="col-num">
                Importe
              </th>
              <th scope="col" className="col-num">
                Saldo resultante
              </th>
              <th scope="col">Portal</th>
              <th scope="col">
                <span className="visually-hidden">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ movement: m, balanceAfter }) => {
              const client = data.clients.find((c) => c.id === m.clientId);
              const account = data.accounts.find((a) => a.id === m.accountId);
              const service = m.type === 'charge' ? data.services.find((s) => s.id === m.serviceId) : undefined;
              const Icon = typeIcons[m.type];
              const detail = [m.method && paymentMethodLabels[m.method], m.reference, m.note].filter(Boolean).join(' · ');
              return (
                <tr key={m.id}>
                  <td data-label="Fecha" className="num cell-date">
                    {formatDate(m.date, today)}
                  </td>
                  {showClient && (
                    <td data-label="Cliente" className="cell-primary">
                      {client ? (
                        <a href={routeHref({ name: 'client', id: client.id })} className="cell-title">
                          {client.name}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  <td data-label="Cuenta">
                    {account ? (
                      <a href={routeHref({ name: 'account', id: account.id })}>{account.alias}</a>
                    ) : (
                      <span className="muted">General</span>
                    )}
                  </td>
                  <td data-label="Tipo" className={showClient ? undefined : 'cell-primary'}>
                    <span className={`type type--${m.type}`}>
                      <Icon size={16} aria-hidden />
                      {movementTypeLabels[m.type]}
                    </span>
                    {detail && <span className="cell-sub">{detail}</span>}
                  </td>
                  <td data-label="Créditos" className="col-num num">
                    {m.credits ? formatCredits(m.credits) : '—'}
                  </td>
                  <td data-label="Precio unitario" className="col-num num">
                    {m.unitPrice !== null ? formatMoney(m.unitPrice) : '—'}
                  </td>
                  <td
                    data-label="Importe"
                    className={`col-num num cell-amount amount--${m.type === 'charge' || (m.type === 'adjustment' && m.amount > 0) ? 'debit' : 'credit'}`}
                  >
                    {signedAmount(m.type, m.amount)}
                  </td>
                  <td data-label="Saldo resultante" className="col-num num">
                    {formatMoney(balanceAfter)}
                  </td>
                  <td data-label="Portal">
                    {service ? <AssignmentBadge status={service.assignment.status} size="sm" /> : <span className="muted">No aplica</span>}
                  </td>
                  <td className="cell-actions">
                    {service?.assignment.status === 'pending' && (
                      <Button
                        variant="plain"
                        icon={Ban}
                        onClick={() => cancel.request(service.id)}
                        aria-label={`Cancelar servicio de ${account?.alias ?? 'la cuenta'}`}
                      >
                        Cancelar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ordered.length > limit && (
        <div className="list-more">
          <Button variant="tinted" onClick={() => setLimit((l) => l + PAGE)}>
            Mostrar más ({ordered.length - limit} restantes)
          </Button>
        </div>
      )}
      {cancel.dialog}
    </>
  );
}

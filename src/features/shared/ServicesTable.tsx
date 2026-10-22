import { Ban, CheckCheck } from 'lucide-react';
import type { AppData, Service } from '../../domain/types';
import { formatCredits, formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { routeHref } from '../../lib/router';
import { Button } from '../../ui/Button';
import { AssignmentBadge } from '../../ui/StatusBadge';
import { useFlows } from '../flows/FlowProvider';
import { useCancelService } from './useCancelService';

/** Historial de servicios: créditos solicitados, precio aplicado y estado en el portal. */
export function ServicesTable({
  services,
  data,
  today,
  showAccount = true,
}: {
  services: Service[];
  data: AppData;
  today: string;
  showAccount?: boolean;
}) {
  const flows = useFlows();
  const cancel = useCancelService();
  const ordered = [...services].sort((a, b) => b.requestedOn.localeCompare(a.requestedOn) || b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="surface surface--wide">
        <table className="table table--services">
          <caption className="visually-hidden">Historial de servicios</caption>
          <thead>
            <tr>
              <th scope="col">Solicitado</th>
              {showAccount && <th scope="col">Cuenta</th>}
              <th scope="col" className="col-num">
                Créditos
              </th>
              <th scope="col" className="col-num">
                Precio aplicado
              </th>
              <th scope="col" className="col-num">
                Total
              </th>
              <th scope="col">Portal</th>
              <th scope="col">Detalle</th>
              <th scope="col">
                <span className="visually-hidden">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((s) => {
              const account = data.accounts.find((a) => a.id === s.accountId);
              const a = s.assignment;
              return (
                <tr key={s.id}>
                  <td data-label="Solicitado" className="num cell-date">
                    {formatDate(s.requestedOn, today)}
                  </td>
                  {showAccount && (
                    <td data-label="Cuenta" className="cell-primary">
                      {account ? (
                        <a className="cell-title" href={routeHref({ name: 'account', id: account.id })}>
                          {account.alias}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  <td data-label="Créditos" className="col-num num">
                    {formatCredits(s.credits)}
                  </td>
                  <td data-label="Precio aplicado" className="col-num num">
                    {formatMoney(s.unitPrice)}
                  </td>
                  <td data-label="Total" className="col-num num cell-amount">
                    {formatMoney(s.total)}
                  </td>
                  <td data-label="Portal">
                    <AssignmentBadge status={a.status} size="sm" />
                  </td>
                  <td data-label="Detalle" className="cell-detail">
                    {a.status === 'assigned' && (
                      <span className="cell-sub num">
                        Asignado {formatDate(a.assignedOn, today)} · vence {formatDate(a.portalExpiresAt, today)}
                        <br />
                        Confirmó {a.confirmedBy} · {a.confirmedAt && formatDateTime(a.confirmedAt)}
                        {a.note && (
                          <>
                            <br />
                            {a.note}
                          </>
                        )}
                      </span>
                    )}
                    {a.status === 'cancelled' && <span className="cell-sub">{a.cancelReason || 'Sin motivo'}</span>}
                    {a.status === 'pending' && <span className="cell-sub">{s.notes || 'Esperando asignación en portal'}</span>}
                  </td>
                  <td className="cell-actions">
                    {a.status === 'pending' && (
                      <div className="cell-actions__group">
                        <Button variant="secondary" icon={CheckCheck} onClick={() => flows.open({ type: 'assign', serviceId: s.id })}>
                          Confirmar asignación
                        </Button>
                        <Button variant="plain" icon={Ban} onClick={() => cancel.request(s.id)}>
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cancel.dialog}
    </>
  );
}

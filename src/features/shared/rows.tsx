import { CheckCheck, RefreshCw, Wallet } from 'lucide-react';
import { chargePaymentState, type ChargeStatus, type ClientSummary } from '../../domain/ledger';
import type { AccountRow, PendingAssignment } from '../../domain/selectors';
import { formatDaysRemaining } from '../../domain/status';
import type { Client } from '../../domain/types';
import { formatCredits, formatDate, formatMoney, maskUsername } from '../../lib/format';
import { routeHref } from '../../lib/router';
import { Button } from '../../ui/Button';
import { AssignmentBadge, ExpiryBadge, PaymentBadge } from '../../ui/StatusBadge';
import { useFlows } from '../flows/FlowProvider';

export function PendingAssignmentRow({
  item,
  charge,
  today,
  showClient = true,
}: {
  item: PendingAssignment;
  charge: ChargeStatus | undefined;
  today: string;
  showClient?: boolean;
}) {
  const flows = useFlows();
  const { service, client, account } = item;
  return (
    <li className="row row--pending">
      <div className="row__main">
        {showClient ? (
          <a className="row__title" href={routeHref({ name: 'client', id: client.id })}>
            {client.name}
          </a>
        ) : (
          <span className="row__title">{account.alias}</span>
        )}
        <span className="row__subtitle">
          {showClient && <>{account.alias} · </>}
          <span className="mono" aria-label={`Usuario ${maskUsername(account.username)}`}>
            {maskUsername(account.username)}
          </span>
        </span>
      </div>
      <dl className="row__facts">
        <div>
          <dt>Créditos</dt>
          <dd className="num">{formatCredits(service.credits)}</dd>
        </div>
        <div>
          <dt>Importe</dt>
          <dd className="num">{formatMoney(service.total)}</dd>
        </div>
        <div>
          <dt>Solicitado</dt>
          <dd className="num">{formatDate(service.requestedOn, today)}</dd>
        </div>
      </dl>
      <div className="row__status">
        <AssignmentBadge status="pending" size="sm" />
        <PaymentBadge state={chargePaymentState(charge)} size="sm" />
      </div>
      <div className="row__action">
        <Button variant="secondary" icon={CheckCheck} onClick={() => flows.open({ type: 'assign', serviceId: service.id })}>
          Confirmar asignación
        </Button>
      </div>
    </li>
  );
}

export function ExpirationRow({ row, today, pendingServiceId }: { row: AccountRow; today: string; pendingServiceId?: string }) {
  const flows = useFlows();
  const { account, client, status } = row;
  return (
    <li className="row row--expiry">
      <div className="row__main">
        <a className="row__title" href={routeHref({ name: 'account', id: account.id })}>
          {client.name}
        </a>
        <span className="row__subtitle">{account.alias}</span>
      </div>
      <dl className="row__facts">
        <div>
          <dt>Vence</dt>
          <dd className="num">{formatDate(account.expiresAt, today)}</dd>
        </div>
        <div>
          <dt>Días</dt>
          <dd className="num">{formatDaysRemaining(status.days)}</dd>
        </div>
      </dl>
      <div className="row__status">
        <ExpiryBadge status={status} size="sm" />
        {pendingServiceId && <AssignmentBadge status="pending" size="sm" label="Renovación por asignar" />}
      </div>
      <div className="row__action">
        {pendingServiceId ? (
          <Button variant="secondary" icon={CheckCheck} onClick={() => flows.open({ type: 'assign', serviceId: pendingServiceId })}>
            Confirmar asignación
          </Button>
        ) : (
          <Button
            variant="plain"
            icon={RefreshCw}
            onClick={() => flows.open({ type: 'service', clientId: client.id, accountId: account.id, renewal: true })}
          >
            Registrar renovación
          </Button>
        )}
      </div>
    </li>
  );
}

export function ReceivableRow({ client, summary, today }: { client: Client; summary: ClientSummary; today: string }) {
  const flows = useFlows();
  return (
    <li className="row row--receivable">
      <div className="row__main">
        <a className="row__title" href={routeHref({ name: 'client', id: client.id })}>
          {client.name}
        </a>
        <span className="row__subtitle num">
          {summary.lastPayment
            ? `Último pago ${formatDate(summary.lastPayment.date, today)} · ${formatMoney(summary.lastPayment.amount)}`
            : 'Sin pagos registrados'}
        </span>
      </div>
      <dl className="row__facts">
        <div>
          <dt>Saldo</dt>
          <dd className="num row__amount">{formatMoney(summary.balance)}</dd>
        </div>
      </dl>
      <div className="row__status">{summary.paymentState && <PaymentBadge state={summary.paymentState} size="sm" />}</div>
      <div className="row__action">
        <Button variant="secondary" icon={Wallet} onClick={() => flows.open({ type: 'payment', clientId: client.id })}>
          Registrar pago
        </Button>
      </div>
    </li>
  );
}

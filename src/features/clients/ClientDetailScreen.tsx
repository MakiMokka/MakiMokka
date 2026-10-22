import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  CircleCheck,
  History,
  Mail,
  Pencil,
  Phone,
  Plus,
  Receipt,
  SlidersHorizontal,
  Tv,
  UserX,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { chargeStatusMap, clientSummary, ledgerRows } from '../../domain/ledger';
import { setClientArchived } from '../../domain/operations';
import { accountRows, pendingAssignments } from '../../domain/selectors';
import { formatDaysRemaining } from '../../domain/status';
import { formatDate, formatDateTime, formatMoney, maskUsername } from '../../lib/format';
import { useToday } from '../../lib/hooks';
import { routeHref } from '../../lib/router';
import { useStore } from '../../store/StoreProvider';
import { Button, LinkButton } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState, List, MetricStrip, PageHeader, Section } from '../../ui/Layout';
import { PrimaryAction } from '../../ui/PrimaryAction';
import { ExpiryBadge, PaymentBadge, StatusBadge } from '../../ui/StatusBadge';
import { useToast } from '../../ui/Toast';
import { useFlows } from '../flows/FlowProvider';
import { MovementsTable } from '../shared/MovementsTable';
import { PendingAssignmentRow } from '../shared/rows';
import { ServicesTable } from '../shared/ServicesTable';

export function ClientDetailScreen({ id }: { id: string }) {
  const { data, commit } = useStore();
  const flows = useFlows();
  const toast = useToast();
  const today = useToday();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const client = data.clients.find((c) => c.id === id);

  const view = useMemo(() => {
    if (!client) return null;
    return {
      summary: clientSummary(data, client.id),
      pending: pendingAssignments(data).filter((p) => p.client.id === client.id),
      accounts: accountRows(data, today, { includeArchived: true }).filter((r) => r.client.id === client.id),
      ledger: ledgerRows(data, client.id),
      services: data.services.filter((s) => s.clientId === client.id),
      charges: chargeStatusMap(data),
    };
  }, [data, client, today]);

  const back = (
    <LinkButton href={routeHref({ name: 'clients' })} icon={ChevronLeft} className="back-link">
      Clientes
    </LinkButton>
  );

  if (!client || !view) {
    return (
      <>
        <PageHeader title="Cliente no encontrado" back={back} />
        <EmptyState icon={UserX} title="Este cliente no existe" message="Puede haberse eliminado o el enlace es incorrecto." />
      </>
    );
  }

  const { summary } = view;
  const previousPrice = client.priceHistory.length > 1 ? client.priceHistory[client.priceHistory.length - 2] : undefined;

  const toggleArchive = () => {
    const error = commit((d) => setClientArchived(d, client.id, !client.archived));
    setConfirmArchive(false);
    if (error) toast.error('No se actualizó el cliente', error);
    else toast.success(client.archived ? 'Cliente restaurado' : 'Cliente archivado', client.name);
  };

  return (
    <>
      <PageHeader
        back={back}
        title={client.name}
        eyebrow={client.archived ? <StatusBadge tone="neutral" icon={Archive} label="Archivado" size="sm" /> : undefined}
        actions={
          <>
            <Button variant="secondary" icon={Wallet} onClick={() => flows.open({ type: 'payment', clientId: client.id })}>
              Registrar pago
            </Button>
            <PrimaryAction label="Registrar servicio" icon={Plus} onClick={() => flows.open({ type: 'service', clientId: client.id })} />
          </>
        }
      >
        <div className="detail-meta">
          <a className="detail-meta__item" href={`tel:${client.phone.replace(/[^\d+]/g, '')}`}>
            <Phone size={16} aria-hidden />
            <span className="num">{client.phone}</span>
          </a>
          {client.email && (
            <a className="detail-meta__item" href={`mailto:${client.email}`}>
              <Mail size={16} aria-hidden />
              <span>{client.email}</span>
            </a>
          )}
        </div>
        <div className="detail-actions">
          <Button variant="tinted" icon={Pencil} onClick={() => flows.open({ type: 'client', clientId: client.id })}>
            Editar
          </Button>
          <Button variant="tinted" icon={SlidersHorizontal} onClick={() => flows.open({ type: 'adjust', clientId: client.id })}>
            Ajuste
          </Button>
          <Button
            variant="tinted"
            icon={client.archived ? ArchiveRestore : Archive}
            onClick={() => (client.archived ? toggleArchive() : setConfirmArchive(true))}
          >
            {client.archived ? 'Restaurar' : 'Archivar'}
          </Button>
        </div>
      </PageHeader>

      <MetricStrip
        label="Resumen del cliente"
        metrics={[
          {
            label: 'Precio vigente',
            value: formatMoney(client.pricePerCredit),
            icon: Receipt,
            tone: 'blue',
            detail: previousPrice ? `Antes ${formatMoney(previousPrice.price)}` : 'por crédito',
          },
          {
            label: 'Cargos',
            value: formatMoney(summary.totalCharges),
            icon: Receipt,
            tone: 'neutral',
            detail: summary.totalAdjustments
              ? `Ajustes ${summary.totalAdjustments > 0 ? '+' : '−'}${formatMoney(Math.abs(summary.totalAdjustments))}`
              : undefined,
          },
          { label: 'Pagos', value: formatMoney(summary.totalPaid), icon: Wallet, tone: 'green' },
          {
            label: 'Saldo',
            value: formatMoney(summary.balance),
            icon: Wallet,
            tone: summary.balance > 0 ? 'coral' : 'green',
            detail: summary.paymentState ? <PaymentBadge state={summary.paymentState} size="sm" /> : 'Sin movimientos',
          },
        ]}
      />

      <div className="detail-grid">
        <div className="detail-grid__main">
          <Section id="cliente-por-asignar" title="Por asignar en el portal" count={view.pending.length}>
            {view.pending.length ? (
              <List label="Solicitudes pendientes">
                {view.pending.map((p) => (
                  <PendingAssignmentRow
                    key={p.service.id}
                    item={p}
                    charge={view.charges.get(p.service.chargeId)}
                    today={today}
                    showClient={false}
                  />
                ))}
              </List>
            ) : (
              <EmptyState compact icon={CircleCheck} title="Sin solicitudes pendientes" />
            )}
          </Section>

          <Section
            id="cliente-cuentas"
            title="Cuentas"
            count={view.accounts.length}
            action={
              <Button variant="plain" icon={Plus} onClick={() => flows.open({ type: 'account', clientId: client.id })}>
                Nueva cuenta
              </Button>
            }
          >
            {view.accounts.length ? (
              <List label="Cuentas del cliente">
                {view.accounts.map((r) => (
                  <li key={r.account.id} className="row row--link">
                    <a className="row__cover" href={routeHref({ name: 'account', id: r.account.id })}>
                      <span className="visually-hidden">Abrir historial de {r.account.alias}</span>
                    </a>
                    <div className="row__main">
                      <span className="row__title">{r.account.alias}</span>
                      <span className="row__subtitle">
                        <span className="mono">{maskUsername(r.account.username)}</span>
                        {r.account.plan && ` · ${r.account.plan}`}
                      </span>
                    </div>
                    <dl className="row__facts">
                      <div>
                        <dt>Vence</dt>
                        <dd className="num">{formatDate(r.account.expiresAt, today)}</dd>
                      </div>
                      <div>
                        <dt>Días</dt>
                        <dd className="num">{formatDaysRemaining(r.status.days)}</dd>
                      </div>
                    </dl>
                    <div className="row__status">
                      {r.account.archived ? (
                        <StatusBadge tone="neutral" icon={Archive} label="Archivada" size="sm" />
                      ) : (
                        <ExpiryBadge status={r.status} size="sm" />
                      )}
                    </div>
                  </li>
                ))}
              </List>
            ) : (
              <EmptyState
                compact
                icon={Tv}
                title="Sin cuentas"
                message="Agrega la cuenta del portal o créala al registrar su primer servicio."
                action={
                  <Button variant="secondary" icon={Plus} onClick={() => flows.open({ type: 'account', clientId: client.id })}>
                    Agregar cuenta
                  </Button>
                }
              />
            )}
          </Section>
        </div>

        <aside className="detail-grid__aside">
          <Section id="cliente-notas" title="Notas y precio">
            <div className="surface surface--padded prose">
              {client.notes ? <p className="pre-line">{client.notes}</p> : <p className="muted">Sin notas.</p>}
              <h3 className="mini-title">Historial del precio habitual</h3>
              <ol className="timeline">
                {[...client.priceHistory].reverse().map((p, i) => (
                  <li key={p.changedAt + i}>
                    <span className="num">{formatMoney(p.price)}</span>
                    <span className="muted num">
                      {i === 0 ? 'Vigente desde' : 'Desde'} {formatDateTime(p.changedAt)}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="muted small">
                Cambiar el precio habitual no modifica cargos anteriores: cada movimiento guarda su precio aplicado.
              </p>
            </div>
          </Section>
        </aside>
      </div>

      <Section id="cliente-movimientos" title="Cargos y pagos" count={view.ledger.length}>
        {view.ledger.length ? (
          <MovementsTable rows={view.ledger} data={data} today={today} showClient={false} />
        ) : (
          <EmptyState compact icon={Receipt} title="Sin movimientos" />
        )}
      </Section>

      <Section id="cliente-servicios" title="Historial de servicios" count={view.services.length}>
        {view.services.length ? (
          <ServicesTable services={view.services} data={data} today={today} />
        ) : (
          <EmptyState compact icon={History} title="Sin servicios registrados" />
        )}
      </Section>

      <ConfirmDialog
        open={confirmArchive}
        title={`¿Archivar a ${client.name}?`}
        message={
          summary.balance > 0
            ? `Tiene un saldo pendiente de ${formatMoney(summary.balance)}. Seguirá apareciendo en cobros hasta que se liquide.`
            : 'Dejará de aparecer en la lista de clientes activos. Su historial se conserva y puedes restaurarlo cuando quieras.'
        }
        confirmLabel="Archivar"
        destructive
        onCancel={() => setConfirmArchive(false)}
        onConfirm={toggleArchive}
      />
    </>
  );
}

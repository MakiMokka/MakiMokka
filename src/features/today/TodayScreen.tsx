import { CalendarCheck, CalendarClock, CalendarX, CircleCheck, Hourglass, Plus, Settings, UserPlus, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { chargeStatusMap, totalReceivable } from '../../domain/ledger';
import { accountRows, pendingAssignments, receivables } from '../../domain/selectors';
import { formatLongDate, formatMoney } from '../../lib/format';
import { useToday } from '../../lib/hooks';
import { routeHref } from '../../lib/router';
import { useStore } from '../../store/StoreProvider';
import { Button, IconButton } from '../../ui/Button';
import { EmptyState, List, MetricStrip, PageHeader, Section, scrollToSection } from '../../ui/Layout';
import { PrimaryAction } from '../../ui/PrimaryAction';
import { useFlows } from '../flows/FlowProvider';
import { ExpirationRow, PendingAssignmentRow, ReceivableRow } from '../shared/rows';

const RECEIVABLES_LIMIT = 8;

export function TodayScreen() {
  const { data } = useStore();
  const flows = useFlows();
  const today = useToday();

  const view = useMemo(() => {
    const pending = pendingAssignments(data);
    const rows = accountRows(data, today);
    const attention = rows.filter((r) => r.status.days !== null && r.status.days <= 7);
    const pendingByAccount = new Map(pending.map((p) => [p.account.id, p.service.id]));
    return {
      pending,
      charges: chargeStatusMap(data),
      attention,
      upcomingCount: attention.filter((r) => (r.status.days ?? -1) >= 0).length,
      expiredCount: attention.filter((r) => (r.status.days ?? 0) < 0).length,
      pendingByAccount,
      debtors: receivables(data),
      receivable: totalReceivable(data),
    };
  }, [data, today]);

  const openService = () => flows.open({ type: 'service' });
  const hasClients = data.clients.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={<time dateTime={today}>{formatLongDate(today)}</time>}
        title="Lo que requiere atención"
        actions={
          <>
            <IconButton icon={Settings} label="Preferencias y respaldo" onClick={() => flows.open({ type: 'settings' })} />
            <PrimaryAction label="Registrar servicio" icon={Plus} onClick={openService} />
          </>
        }
      />

      <MetricStrip
        label="Resumen del día"
        metrics={[
          {
            label: 'Por asignar',
            value: view.pending.length,
            icon: Hourglass,
            tone: 'yellow',
            onSelect: () => scrollToSection('por-asignar'),
          },
          {
            label: 'Vencen en 7 días',
            value: view.upcomingCount,
            icon: CalendarClock,
            tone: 'yellow',
            onSelect: () => scrollToSection('vencimientos'),
          },
          { label: 'Vencidas', value: view.expiredCount, icon: CalendarX, tone: 'coral', onSelect: () => scrollToSection('vencimientos') },
          {
            label: 'Por cobrar',
            value: formatMoney(view.receivable),
            icon: Wallet,
            tone: 'blue',
            onSelect: () => scrollToSection('cobros'),
          },
        ]}
      />

      {!hasClients ? (
        <EmptyState
          icon={UserPlus}
          title="Empieza agregando tu primer cliente"
          message="Después registra sus cuentas y servicios. Aquí verás lo que falta asignar, lo que vence y lo que te deben."
          action={
            <Button variant="primary" icon={UserPlus} onClick={() => flows.open({ type: 'client' })}>
              Agregar cliente
            </Button>
          }
        />
      ) : (
        <div className="today-grid">
          <Section
            id="por-asignar"
            title="Por asignar en el portal"
            count={view.pending.length}
            description="Asigna los créditos en el portal de PopTV y después confírmalo aquí."
            className="today-grid__pending"
          >
            {view.pending.length ? (
              <List label="Servicios por asignar">
                {view.pending.map((p) => (
                  <PendingAssignmentRow key={p.service.id} item={p} charge={view.charges.get(p.service.chargeId)} today={today} />
                ))}
              </List>
            ) : (
              <EmptyState
                compact
                icon={CircleCheck}
                title="Nada por asignar"
                message="Todos los servicios registrados ya están confirmados en el portal."
              />
            )}
          </Section>

          <Section
            id="vencimientos"
            className="today-grid__expiry"
            title="Próximos vencimientos"
            count={view.attention.length}
            description="Vencidas y cuentas que vencen en los próximos 7 días."
            action={
              <a className="text-link" href={routeHref({ name: 'accounts' })}>
                Ver cuentas
              </a>
            }
          >
            {view.attention.length ? (
              <List label="Próximos vencimientos">
                {view.attention.map((r) => (
                  <ExpirationRow key={r.account.id} row={r} today={today} pendingServiceId={view.pendingByAccount.get(r.account.id)} />
                ))}
              </List>
            ) : (
              <EmptyState
                compact
                icon={CalendarCheck}
                title="Sin vencimientos próximos"
                message="Ninguna cuenta vence en los próximos 7 días."
              />
            )}
          </Section>

          <Section
            id="cobros"
            className="today-grid__receivables"
            title="Cobros pendientes"
            count={view.debtors.length}
            action={
              <a className="text-link" href={routeHref({ name: 'billing' })}>
                Ver cobros
              </a>
            }
          >
            {view.debtors.length ? (
              <List label="Clientes con saldo">
                {view.debtors.slice(0, RECEIVABLES_LIMIT).map((r) => (
                  <ReceivableRow key={r.client.id} client={r.client} summary={r.summary} today={today} />
                ))}
              </List>
            ) : (
              <EmptyState compact icon={CircleCheck} title="Todo cobrado" message="Ningún cliente tiene saldo pendiente." />
            )}
            {view.debtors.length > RECEIVABLES_LIMIT && (
              <p className="section__more">
                <a className="text-link" href={routeHref({ name: 'billing' })}>
                  Ver los {view.debtors.length} clientes con saldo
                </a>
              </p>
            )}
          </Section>
        </div>
      )}
    </>
  );
}

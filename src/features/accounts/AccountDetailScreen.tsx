import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  CheckCheck,
  ChevronLeft,
  Eye,
  EyeOff,
  History,
  Hourglass,
  Pencil,
  RefreshCw,
  Trash2,
  Tv,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { canDeleteAccount, deleteAccount, setAccountArchived } from '../../domain/operations';
import { accountRows } from '../../domain/selectors';
import { formatDaysRemaining } from '../../domain/status';
import { formatCredits, formatDate, formatDateTime, formatMoney, maskUsername } from '../../lib/format';
import { useToday } from '../../lib/hooks';
import { navigate, routeHref } from '../../lib/router';
import { useStore } from '../../store/StoreProvider';
import { Button, IconButton, LinkButton } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState, MetricStrip, PageHeader, Section } from '../../ui/Layout';
import { PrimaryAction } from '../../ui/PrimaryAction';
import { ExpiryBadge, StatusBadge } from '../../ui/StatusBadge';
import { useToast } from '../../ui/Toast';
import { useFlows } from '../flows/FlowProvider';
import { ServicesTable } from '../shared/ServicesTable';

export function AccountDetailScreen({ id }: { id: string }) {
  const { data, commit } = useStore();
  const flows = useFlows();
  const toast = useToast();
  const today = useToday();
  const [revealed, setRevealed] = useState(false);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const row = useMemo(() => accountRows(data, today, { includeArchived: true }).find((r) => r.account.id === id), [data, today, id]);

  const back = (
    <LinkButton href={routeHref({ name: 'accounts' })} icon={ChevronLeft} className="back-link">
      Cuentas
    </LinkButton>
  );

  if (!row) {
    return (
      <>
        <PageHeader title="Cuenta no encontrada" back={back} />
        <EmptyState icon={Tv} title="Esta cuenta no existe" message="Puede haberse eliminado o el enlace es incorrecto." />
      </>
    );
  }

  const { account, client, status } = row;
  const services = data.services.filter((s) => s.accountId === account.id);
  const deletable = canDeleteAccount(data, account.id);
  const pendingService = services.find((s) => s.assignment.status === 'pending');

  const apply = () => {
    const action = confirm;
    setConfirm(null);
    const error = commit((d) =>
      action === 'delete' ? deleteAccount(d, account.id) : setAccountArchived(d, account.id, !account.archived),
    );
    if (error) {
      toast.error('No se pudo completar la acción', error);
      return;
    }
    if (action === 'delete') {
      toast.success('Cuenta eliminada', account.alias);
      navigate({ name: 'accounts' });
    } else toast.success(account.archived ? 'Cuenta restaurada' : 'Cuenta archivada', account.alias);
  };

  return (
    <>
      <PageHeader
        back={back}
        title={account.alias}
        eyebrow={
          <a href={routeHref({ name: 'client', id: client.id })} className="eyebrow-link">
            {client.name}
          </a>
        }
        actions={
          pendingService ? (
            <PrimaryAction
              label="Confirmar asignación"
              icon={CheckCheck}
              onClick={() => flows.open({ type: 'assign', serviceId: pendingService.id })}
            />
          ) : (
            <PrimaryAction
              label="Registrar renovación"
              icon={RefreshCw}
              onClick={() => flows.open({ type: 'service', clientId: client.id, accountId: account.id, renewal: true })}
            />
          )
        }
      >
        <div className="detail-meta">
          <span className="detail-meta__item">
            <span className="mono">{revealed ? account.username : maskUsername(account.username)}</span>
            <IconButton
              icon={revealed ? EyeOff : Eye}
              label={revealed ? 'Ocultar usuario' : 'Mostrar usuario completo'}
              onClick={() => setRevealed((v) => !v)}
            />
          </span>
          {account.plan && <span className="detail-meta__item">{account.plan}</span>}
          {account.archived && <StatusBadge tone="neutral" icon={Archive} label="Archivada" size="sm" />}
        </div>
        <div className="detail-actions">
          <Button variant="tinted" icon={Pencil} onClick={() => flows.open({ type: 'account', accountId: account.id })}>
            Editar
          </Button>
          {deletable ? (
            <Button variant="tinted" icon={Trash2} onClick={() => setConfirm('delete')}>
              Eliminar
            </Button>
          ) : (
            <Button
              variant="tinted"
              icon={account.archived ? ArchiveRestore : Archive}
              onClick={() => (account.archived ? apply() : setConfirm('archive'))}
            >
              {account.archived ? 'Restaurar' : 'Archivar'}
            </Button>
          )}
        </div>
      </PageHeader>

      <MetricStrip
        label="Resumen de la cuenta"
        metrics={[
          {
            label: 'Vencimiento',
            value: formatDate(account.expiresAt, today),
            icon: CalendarClock,
            tone: status.tone === 'neutral' ? 'neutral' : status.tone,
            detail: <ExpiryBadge status={status} size="sm" />,
          },
          { label: 'Días restantes', value: formatDaysRemaining(status.days), icon: Hourglass, tone: 'blue' },
          { label: 'Últimos créditos', value: row.lastAssigned ? formatCredits(row.lastAssigned.credits) : '—', icon: Tv, tone: 'green' },
          { label: 'Saldo de la cuenta', value: formatMoney(row.outstanding), icon: Wallet, tone: row.outstanding > 0 ? 'coral' : 'green' },
        ]}
      />

      <div className="detail-grid">
        <div className="detail-grid__main">
          <Section id="cuenta-vencimientos" title="Historial de vencimientos" description="Fechas capturadas desde el portal.">
            {account.expiryHistory.length ? (
              <div className="surface surface--padded">
                <ol className="timeline">
                  {[...account.expiryHistory].reverse().map((h, i) => (
                    <li key={h.changedAt + i}>
                      <span className="num">
                        {formatDate(h.previous, today)} → <strong>{formatDate(h.next, today)}</strong>
                      </span>
                      <span className="muted num">
                        {h.serviceId ? 'Asignación confirmada' : 'Captura manual'} · {formatDateTime(h.changedAt)}
                        {h.changedBy && ` · ${h.changedBy}`}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <EmptyState
                compact
                icon={History}
                title="Sin vencimientos registrados"
                message="Se registrará al confirmar la primera asignación."
              />
            )}
          </Section>
        </div>
        <aside className="detail-grid__aside">
          <Section id="cuenta-notas" title="Notas">
            <div className="surface surface--padded">
              {account.notes ? <p className="pre-line">{account.notes}</p> : <p className="muted">Sin notas.</p>}
            </div>
          </Section>
        </aside>
      </div>

      <Section id="cuenta-servicios" title="Servicios" count={services.length}>
        {services.length ? (
          <ServicesTable services={services} data={data} today={today} showAccount={false} />
        ) : (
          <EmptyState compact icon={History} title="Sin servicios registrados" />
        )}
      </Section>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'delete' ? `¿Eliminar ${account.alias}?` : `¿Archivar ${account.alias}?`}
        message={
          confirm === 'delete'
            ? 'La cuenta no tiene movimientos, así que se eliminará por completo. Esta acción no se puede deshacer.'
            : 'Dejará de aparecer en Cuentas y en los vencimientos. Su historial y movimientos se conservan.'
        }
        confirmLabel={confirm === 'delete' ? 'Eliminar' : 'Archivar'}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={apply}
      />
    </>
  );
}

import { Copy, TriangleAlert } from 'lucide-react';
import { useCallback, useState } from 'react';
import { daysBetween, isValidISODate, todayISO } from '../../domain/dates';
import { confirmAssignment } from '../../domain/operations';
import { expiryStatus, formatDaysRemaining } from '../../domain/status';
import { validateAssignment, type AssignmentDraft } from '../../domain/validation';
import { formatCredits, formatDate, formatMoney } from '../../lib/format';
import { useToday } from '../../lib/hooks';
import { useForm } from '../../lib/useForm';
import { useStore } from '../../store/StoreProvider';
import { Button } from '../../ui/Button';
import { FormErrorSummary, TextAreaField, TextField } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { AssignmentBadge, ExpiryBadge } from '../../ui/StatusBadge';
import { useToast } from '../../ui/Toast';

export function ConfirmAssignmentSheet({ serviceId, onClose }: { serviceId: string; onClose: () => void }) {
  const { data, commit } = useStore();
  const toast = useToast();
  const today = useToday();
  const service = data.services.find((s) => s.id === serviceId);
  const account = data.accounts.find((a) => a.id === service?.accountId);
  const client = data.clients.find((c) => c.id === service?.clientId);
  const [copied, setCopied] = useState(false);

  const validate = useCallback((d: AssignmentDraft) => validateAssignment(d, today), [today]);
  const form = useForm(
    (): AssignmentDraft => ({ assignedOn: todayISO(), portalExpiresAt: '', confirmedBy: data.settings.operatorName, note: '' }),
    validate,
  );
  const { draft, set, errors } = form;

  if (!service || !account || !client) {
    return (
      <Sheet open onClose={onClose} title="Confirmar asignación">
        <p className="muted">Este servicio ya no existe.</p>
      </Sheet>
    );
  }

  if (service.assignment.status !== 'pending') {
    return (
      <Sheet open onClose={onClose} title="Confirmar asignación">
        <p className="callout callout--green">
          Este servicio ya fue {service.assignment.status === 'assigned' ? 'asignado' : 'cancelado'}.
        </p>
      </Sheet>
    );
  }

  const preview = isValidISODate(draft.portalExpiresAt) ? expiryStatus(draft.portalExpiresAt, today) : null;
  const notLater = preview && account.expiresAt && draft.portalExpiresAt <= account.expiresAt;

  const copyUser = async () => {
    try {
      await navigator.clipboard.writeText(account.username);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar', 'Selecciona el usuario y cópialo manualmente.');
    }
  };

  const save = () => {
    const input = form.submit();
    if (!input) return;
    const error = commit((d, ctx) => confirmAssignment(d, serviceId, input, ctx));
    if (error) {
      toast.error('No se confirmó la asignación', error);
      return;
    }
    const days = daysBetween(today, input.portalExpiresAt);
    toast.success(
      'Asignación confirmada',
      `${account.alias} vence el ${formatDate(input.portalExpiresAt, today)} (${formatDaysRemaining(days)}).`,
    );
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Confirmar asignación"
      subtitle="Registra lo que ya hiciste en el portal de PopTV."
      onSubmit={save}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" className="btn--grow-mobile">
            Confirmar asignación
          </Button>
        </>
      }
    >
      <dl className="summary-list">
        <div>
          <dt>Cliente</dt>
          <dd>{client.name}</dd>
        </div>
        <div>
          <dt>Cuenta</dt>
          <dd>{account.alias}</dd>
        </div>
        <div>
          <dt>Usuario en portal</dt>
          <dd className="summary-list__copy">
            <span className="mono">{account.username}</span>
            <button type="button" className="text-link text-link--icon" onClick={copyUser}>
              <Copy size={16} aria-hidden />
              <span aria-live="polite">{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </dd>
        </div>
        <div>
          <dt>Créditos a asignar</dt>
          <dd className="num">
            {formatCredits(service.credits)} · {formatMoney(service.total)}
          </dd>
        </div>
        <div>
          <dt>Vencimiento actual</dt>
          <dd className="summary-list__badge">
            <span className="num">{formatDate(account.expiresAt, today)}</span>
            <ExpiryBadge status={expiryStatus(account.expiresAt, today)} size="sm" />
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <AssignmentBadge status="pending" size="sm" label="Por asignar en portal" />
          </dd>
        </div>
      </dl>

      <FormErrorSummary count={form.errorCount} />
      <div className="form-group">
        <div className="form-row">
          <TextField
            label="Fecha de asignación"
            type="date"
            max={today}
            value={draft.assignedOn}
            onValueChange={(v) => set('assignedOn', v)}
            error={errors.assignedOn}
          />
          <TextField
            label="Vencimiento en el portal"
            type="date"
            value={draft.portalExpiresAt}
            onValueChange={(v) => set('portalExpiresAt', v)}
            error={errors.portalExpiresAt}
            hint="Cópiala tal como aparece en el portal."
            data-autofocus
          />
        </div>
        {preview && (
          <div className="total-line total-line--compact" aria-live="polite">
            <span className="total-line__label">Días restantes</span>
            <span className="total-line__value num">{formatDaysRemaining(preview.days)}</span>
            <ExpiryBadge status={preview} size="sm" />
          </div>
        )}
        {notLater && (
          <p className="callout callout--yellow" role="status">
            <TriangleAlert size={18} aria-hidden />
            <span>
              La fecha no es posterior al vencimiento actual ({formatDate(account.expiresAt, today)}). Verifica en el portal antes de
              confirmar.
            </span>
          </p>
        )}
        <TextField
          label="Confirmado por"
          value={draft.confirmedBy}
          onValueChange={(v) => set('confirmedBy', v)}
          error={errors.confirmedBy}
          autoComplete="name"
          hint="Se guarda junto con la fecha y hora de confirmación."
        />
        <TextAreaField label="Nota" optional value={draft.note} onValueChange={(v) => set('note', v)} />
      </div>
    </Sheet>
  );
}

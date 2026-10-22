import { Info, Minus, Plus, UserPlus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { todayISO } from '../../domain/dates';
import { DAYS_PER_CREDIT, paymentMethodLabels, paymentMethods } from '../../domain/labels';
import { centsToInput, parseMoney } from '../../domain/money';
import { registerService } from '../../domain/operations';
import type { PaymentState } from '../../domain/status';
import type { AppData, PaymentMethod } from '../../domain/types';
import { NEW_ACCOUNT, parseCredits, validateService, type ServiceDraft } from '../../domain/validation';
import { formatCredits, formatMoney } from '../../lib/format';
import { TABLET_QUERY, useMediaQuery } from '../../lib/hooks';
import { useForm } from '../../lib/useForm';
import { useStore } from '../../store/StoreProvider';
import { Button } from '../../ui/Button';
import { FormErrorSummary, MoneyField, SelectField, TextAreaField, TextField } from '../../ui/Field';
import { EmptyState } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { PaymentBadge } from '../../ui/StatusBadge';
import { useToast } from '../../ui/Toast';
import { useFlows } from './FlowProvider';

interface Props {
  clientId?: string;
  accountId?: string;
  renewal?: boolean;
  onClose: () => void;
}

const STEP_ONE: (keyof ServiceDraft)[] = ['clientId', 'accountId', 'newAlias', 'newUsername', 'credits', 'unitPrice', 'requestedOn'];

function initialDraft(data: AppData, clientId?: string, accountId?: string): ServiceDraft {
  const client = data.clients.find((c) => c.id === clientId);
  const accounts = data.accounts.filter((a) => a.clientId === clientId && !a.archived);
  return {
    clientId: client?.id ?? '',
    accountId: accountId ?? (accounts.length === 1 ? accounts[0]!.id : ''),
    newAlias: '',
    newUsername: '',
    newPlan: '',
    credits: '1',
    unitPrice: client ? centsToInput(client.pricePerCredit) : '',
    amountPaid: '',
    method: '',
    notes: '',
    requestedOn: todayISO(),
  };
}

export function RegisterServiceSheet({ clientId, accountId, renewal, onClose }: Props) {
  const { data, commit } = useStore();
  const toast = useToast();
  const flows = useFlows();
  const wide = useMediaQuery(TABLET_QUERY);
  const [step, setStep] = useState<1 | 2>(1);
  const validate = useCallback((d: ServiceDraft) => validateService(d, data), [data]);
  const form = useForm(() => initialDraft(data, clientId, accountId), validate);
  const { draft, set, patch, errors } = form;

  const clients = useMemo(
    () => data.clients.filter((c) => !c.archived || c.id === draft.clientId).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [data.clients, draft.clientId],
  );
  const client = data.clients.find((c) => c.id === draft.clientId);
  const accounts = data.accounts.filter((a) => a.clientId === draft.clientId && (!a.archived || a.id === draft.accountId));

  const credits = parseCredits(draft.credits);
  const unitPrice = parseMoney(draft.unitPrice);
  const total = credits !== null && unitPrice !== null && unitPrice >= 0 ? Math.round(credits * unitPrice) : null;
  const paid = parseMoney(draft.amountPaid) ?? 0;
  const priceOverridden = client && unitPrice !== null && unitPrice !== client.pricePerCredit;
  const paymentPreview: PaymentState | null =
    total === null || total === 0 ? null : paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending';

  const selectClient = (id: string) => {
    const c = data.clients.find((x) => x.id === id);
    const own = data.accounts.filter((a) => a.clientId === id && !a.archived);
    patch({
      clientId: id,
      accountId: own.length === 1 ? own[0]!.id : own.length === 0 && id ? NEW_ACCOUNT : '',
      unitPrice: c ? centsToInput(c.pricePerCredit) : '',
    });
  };

  const stepCredits = (delta: number) => {
    const n = Math.max(1, Math.min(999, (credits ?? 0) + delta));
    set('credits', String(n));
  };

  const save = () => {
    const input = form.submit();
    if (!input) {
      if (!wide && STEP_ONE.some((f) => validate(draft).errors[f])) setStep(1);
      return;
    }
    let created = '';
    const error = commit((d, ctx) => {
      const r = registerService(d, input, ctx);
      created = r.service.accountId;
      return r.data;
    });
    if (error) {
      toast.error('No se registró el servicio', error);
      return;
    }
    const acc = data.accounts.find((a) => a.id === created);
    const label = acc?.alias ?? input.newAccount?.alias ?? '';
    toast.success('Servicio registrado: por asignar en portal', `${client?.name ?? ''} · ${label} · ${formatCredits(input.credits)}`);
    onClose();
  };

  const next = () => {
    if (form.check(STEP_ONE)) setStep(2);
  };

  if (data.clients.filter((c) => !c.archived).length === 0) {
    return (
      <Sheet open onClose={onClose} title="Registrar servicio">
        <EmptyState
          icon={UserPlus}
          title="Primero agrega un cliente"
          message="Cada servicio se registra a nombre de un cliente y una de sus cuentas."
          action={
            <Button variant="primary" icon={UserPlus} onClick={() => flows.open({ type: 'client', thenService: true })}>
              Agregar cliente
            </Button>
          }
        />
      </Sheet>
    );
  }

  const showStep1 = wide || step === 1;
  const showStep2 = wide || step === 2;

  const footer = wide ? (
    <>
      <Button variant="tinted" onClick={onClose}>
        Cancelar
      </Button>
      <Button variant="primary" type="submit">
        Guardar servicio
      </Button>
    </>
  ) : step === 1 ? (
    <Button variant="primary" size="lg" block onClick={next}>
      Continuar
    </Button>
  ) : (
    <>
      <Button variant="tinted" size="lg" onClick={() => setStep(1)}>
        Atrás
      </Button>
      <Button variant="primary" size="lg" type="submit" className="btn--grow">
        Guardar servicio
      </Button>
    </>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title={renewal ? 'Registrar renovación' : 'Registrar servicio'}
      subtitle={wide ? undefined : `Paso ${step} de 2 · ${step === 1 ? 'Servicio' : 'Pago'}`}
      onSubmit={wide || step === 2 ? save : next}
      footer={footer}
    >
      <FormErrorSummary count={form.errorCount} />
      {showStep1 && (
        <fieldset className="form-group">
          <legend className="form-group__title">Servicio</legend>
          <SelectField
            label="Cliente"
            value={draft.clientId}
            onValueChange={selectClient}
            error={errors.clientId}
            data-autofocus={!draft.clientId || undefined}
          >
            <option value="">Selecciona un cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <p className="field-inline-action">
            <button type="button" className="text-link" onClick={() => flows.open({ type: 'client', thenService: true })}>
              Agregar cliente nuevo
            </button>
          </p>

          <SelectField
            label="Cuenta"
            value={draft.accountId}
            onValueChange={(v) => set('accountId', v)}
            error={errors.accountId}
            disabled={!draft.clientId}
            hint={!draft.clientId ? 'Primero selecciona el cliente.' : undefined}
          >
            <option value="">{accounts.length ? 'Selecciona una cuenta' : 'Sin cuentas registradas'}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.alias} — {a.username}
              </option>
            ))}
            <option value={NEW_ACCOUNT}>Nueva cuenta…</option>
          </SelectField>

          {draft.accountId === NEW_ACCOUNT && (
            <div className="form-nested">
              <TextField
                label="Alias de la cuenta"
                value={draft.newAlias}
                onValueChange={(v) => set('newAlias', v)}
                error={errors.newAlias}
                autoComplete="off"
                placeholder="Ej. Sala, Recámara"
              />
              <TextField
                label="Usuario en el portal"
                value={draft.newUsername}
                onValueChange={(v) => set('newUsername', v)}
                error={errors.newUsername}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <TextField
                label="Versión o plan"
                optional
                value={draft.newPlan}
                onValueChange={(v) => set('newPlan', v)}
                autoComplete="off"
              />
            </div>
          )}

          <div className="form-row">
            <div className="stepper-field">
              <TextField
                label="Créditos"
                value={draft.credits}
                onValueChange={(v) => set('credits', v.replace(/\D/g, ''))}
                error={errors.credits}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                hint={credits ? `1 crédito = ${DAYS_PER_CREDIT} días` : undefined}
                fieldClassName="stepper-field__input"
              />
              <div className="stepper" role="group" aria-label="Ajustar créditos">
                <button
                  type="button"
                  className="stepper__btn"
                  aria-label="Quitar un crédito"
                  onClick={() => stepCredits(-1)}
                  disabled={(credits ?? 0) <= 1}
                >
                  <Minus size={18} aria-hidden />
                </button>
                <button type="button" className="stepper__btn" aria-label="Agregar un crédito" onClick={() => stepCredits(1)}>
                  <Plus size={18} aria-hidden />
                </button>
              </div>
            </div>
            <MoneyField
              label="Precio por crédito"
              value={draft.unitPrice}
              onValueChange={(v) => set('unitPrice', v)}
              error={errors.unitPrice}
              hint={
                client ? (
                  priceOverridden ? (
                    <>
                      Solo para esta operación. Habitual: {formatMoney(client.pricePerCredit)}.{' '}
                      <button type="button" className="text-link" onClick={() => set('unitPrice', centsToInput(client.pricePerCredit))}>
                        Restablecer
                      </button>
                    </>
                  ) : (
                    'Precio habitual del cliente'
                  )
                ) : undefined
              }
            />
          </div>

          <div className="total-line" aria-live="polite">
            <span className="total-line__label">Total</span>
            <span className="total-line__formula num">
              {credits && unitPrice !== null ? `${formatCredits(credits)} × ${formatMoney(unitPrice)}` : '—'}
            </span>
            <strong className="total-line__value num">{total !== null ? formatMoney(total) : '—'}</strong>
          </div>

          <TextField
            label="Fecha de solicitud"
            type="date"
            value={draft.requestedOn}
            onValueChange={(v) => set('requestedOn', v)}
            error={errors.requestedOn}
          />
        </fieldset>
      )}

      {showStep2 && (
        <fieldset className="form-group">
          <legend className="form-group__title">Pago</legend>
          {!wide && total !== null && (
            <div className="total-line total-line--compact">
              <span className="total-line__label">Total del servicio</span>
              <strong className="total-line__value num">{formatMoney(total)}</strong>
            </div>
          )}
          <MoneyField
            label="Importe pagado"
            optional
            value={draft.amountPaid}
            onValueChange={(v) => set('amountPaid', v)}
            error={errors.amountPaid}
            hint="Déjalo vacío si aún no paga."
          />
          <div className="quick-actions">
            <Button variant="tinted" disabled={total === null} onClick={() => total !== null && set('amountPaid', centsToInput(total))}>
              Pago completo
            </Button>
            <Button variant="tinted" onClick={() => patch({ amountPaid: '', method: '' })}>
              Sin pago
            </Button>
            {paymentPreview && <PaymentBadge state={paymentPreview} size="sm" />}
          </div>
          {paid > 0 && (
            <SelectField
              label="Método de pago"
              value={draft.method}
              onValueChange={(v) => set('method', v as PaymentMethod | '')}
              error={errors.method}
            >
              <option value="">Selecciona un método</option>
              {paymentMethods.map((m) => (
                <option key={m} value={m}>
                  {paymentMethodLabels[m]}
                </option>
              ))}
            </SelectField>
          )}
          <TextAreaField label="Notas" optional value={draft.notes} onValueChange={(v) => set('notes', v)} />
          <p className="callout callout--yellow">
            <Info size={18} aria-hidden />
            <span>
              Al guardar, el servicio queda <strong>Por asignar en portal</strong>. El vencimiento de la cuenta no cambia hasta que
              confirmes la asignación.
            </span>
          </p>
        </fieldset>
      )}
    </Sheet>
  );
}

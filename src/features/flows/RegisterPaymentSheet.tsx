import { useCallback, useMemo } from 'react';
import { todayISO } from '../../domain/dates';
import { paymentMethodLabels, paymentMethods } from '../../domain/labels';
import { clientBalance, distributePayment, openCharges } from '../../domain/ledger';
import { centsToInput, parseMoney } from '../../domain/money';
import { registerPayment } from '../../domain/operations';
import type { PaymentMethod } from '../../domain/types';
import { validatePayment, type PaymentDraft } from '../../domain/validation';
import { formatCredits, formatDate, formatMoney } from '../../lib/format';
import { useToday } from '../../lib/hooks';
import { useForm } from '../../lib/useForm';
import { useStore } from '../../store/StoreProvider';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Controls';
import { FormErrorSummary, MoneyField, SelectField, TextField } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

interface Props {
  clientId?: string;
  chargeIds?: string[];
  onClose: () => void;
}

export function RegisterPaymentSheet({ clientId, chargeIds, onClose }: Props) {
  const { data, commit } = useStore();
  const toast = useToast();
  const today = useToday();
  const validate = useCallback((d: PaymentDraft) => validatePayment(d, data), [data]);
  const form = useForm(
    (): PaymentDraft => ({
      clientId: clientId ?? '',
      amount: '',
      method: '',
      date: todayISO(),
      reference: '',
      target: chargeIds?.length ? 'charges' : 'general',
      chargeIds: chargeIds ?? [],
    }),
    validate,
  );
  const { draft, set, patch, errors } = form;

  const clients = useMemo(
    () =>
      data.clients
        .filter((c) => !c.archived || c.id === draft.clientId)
        .map((c) => ({ client: c, balance: clientBalance(data, c.id) }))
        .sort((a, b) => (b.balance > 0 ? 1 : 0) - (a.balance > 0 ? 1 : 0) || a.client.name.localeCompare(b.client.name, 'es')),
    [data, draft.clientId],
  );
  const balance = draft.clientId ? clientBalance(data, draft.clientId) : 0;
  const charges = draft.clientId ? openCharges(data, draft.clientId) : [];
  const amount = parseMoney(draft.amount);
  const after = amount !== null ? balance - amount : null;
  const selected = charges.filter((c) => draft.chargeIds.includes(c.chargeId));
  const distribution = draft.target === 'charges' && amount ? distributePayment(amount, selected) : null;

  const toggleCharge = (id: string) =>
    set('chargeIds', draft.chargeIds.includes(id) ? draft.chargeIds.filter((x) => x !== id) : [...draft.chargeIds, id]);

  const save = () => {
    const input = form.submit();
    if (!input) return;
    const error = commit((d, ctx) => registerPayment(d, input, ctx));
    if (error) {
      toast.error('No se registró el pago', error);
      return;
    }
    const client = data.clients.find((c) => c.id === input.clientId);
    const nextBalance = balance - input.amount;
    toast.success(
      `Pago de ${formatMoney(input.amount)} registrado`,
      `${client?.name ?? ''}: ${nextBalance < 0 ? `saldo a favor ${formatMoney(-nextBalance)}` : `saldo ${formatMoney(nextBalance)}`}.`,
    );
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Registrar pago"
      subtitle="Un pago reduce el saldo; no asigna créditos en el portal."
      onSubmit={save}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" className="btn--grow-mobile">
            Registrar pago
          </Button>
        </>
      }
    >
      <FormErrorSummary count={form.errorCount} />
      <div className="form-group">
        <SelectField
          label="Cliente"
          value={draft.clientId}
          onValueChange={(v) => patch({ clientId: v, chargeIds: [], target: 'general' })}
          error={errors.clientId}
          data-autofocus={!draft.clientId || undefined}
        >
          <option value="">Selecciona un cliente</option>
          {clients.map(({ client, balance: b }) => (
            <option key={client.id} value={client.id}>
              {client.name}
              {b > 0 ? ` — debe ${formatMoney(b)}` : ''}
            </option>
          ))}
        </SelectField>

        {draft.clientId && (
          <div className="total-line total-line--compact">
            <span className="total-line__label">Saldo actual</span>
            <strong className={`total-line__value num${balance > 0 ? ' text-coral' : ''}`}>{formatMoney(balance)}</strong>
          </div>
        )}

        <MoneyField
          label="Importe"
          value={draft.amount}
          onValueChange={(v) => set('amount', v)}
          error={errors.amount}
          data-autofocus={draft.clientId ? true : undefined}
        />
        {balance > 0 && (
          <div className="quick-actions">
            <Button variant="tinted" onClick={() => set('amount', centsToInput(balance))}>
              Liquidar saldo ({formatMoney(balance)})
            </Button>
          </div>
        )}

        <div className="form-row">
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
          <TextField label="Fecha del pago" type="date" value={draft.date} onValueChange={(v) => set('date', v)} error={errors.date} />
        </div>
        <TextField
          label="Referencia o nota"
          optional
          value={draft.reference}
          onValueChange={(v) => set('reference', v)}
          autoComplete="off"
          placeholder="Ej. folio de transferencia"
        />

        {draft.clientId && charges.length > 0 && (
          <fieldset className="form-subgroup">
            <legend className="field__label">Aplicar a</legend>
            <Segmented
              label="Aplicar pago a"
              value={draft.target}
              onChange={(v) => set('target', v)}
              options={[
                { value: 'general', label: 'Saldo general' },
                { value: 'charges', label: 'Cargos específicos' },
              ]}
            />
            {draft.target === 'general' ? (
              <p className="field__hint">Se aplicará primero a los cargos más antiguos.</p>
            ) : (
              <>
                <ul className="check-list" aria-describedby={errors.chargeIds ? 'charges-error' : undefined}>
                  {charges.map((c) => {
                    const account = data.accounts.find((a) => a.id === c.accountId);
                    const applied = distribution?.allocations.find((a) => a.chargeId === c.chargeId)?.amount;
                    return (
                      <li key={c.chargeId}>
                        <label className="check-row">
                          <input type="checkbox" checked={draft.chargeIds.includes(c.chargeId)} onChange={() => toggleCharge(c.chargeId)} />
                          <span className="check-row__main">
                            <span className="check-row__title">
                              {account?.alias ?? 'Cuenta'} · {c.credits ? formatCredits(c.credits) : 'Cargo'}
                            </span>
                            <span className="check-row__meta num">
                              {formatDate(c.date, today)} · pendiente {formatMoney(c.outstanding)}
                              {c.paid > 0 && ` de ${formatMoney(c.amount)}`}
                            </span>
                          </span>
                          {applied ? <span className="check-row__applied num">−{formatMoney(applied)}</span> : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {errors.chargeIds && (
                  <p className="field__error" id="charges-error" role="alert">
                    {errors.chargeIds}
                  </p>
                )}
              </>
            )}
          </fieldset>
        )}

        {after !== null && draft.clientId && (
          <div className="total-line" aria-live="polite">
            <span className="total-line__label">Saldo después del pago</span>
            <strong className="total-line__value num">{after < 0 ? `${formatMoney(-after)} a favor` : formatMoney(after)}</strong>
          </div>
        )}
      </div>
    </Sheet>
  );
}

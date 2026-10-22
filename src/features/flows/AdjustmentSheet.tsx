import { useCallback } from 'react';
import { todayISO } from '../../domain/dates';
import { clientBalance } from '../../domain/ledger';
import { parseMoney } from '../../domain/money';
import { registerAdjustment } from '../../domain/operations';
import { validateAdjustment, type AdjustmentDraft } from '../../domain/validation';
import { formatMoney } from '../../lib/format';
import { useForm } from '../../lib/useForm';
import { useStore } from '../../store/StoreProvider';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Controls';
import { FormErrorSummary, MoneyField, TextAreaField, TextField } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

export function AdjustmentSheet({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { data, commit } = useStore();
  const toast = useToast();
  const client = data.clients.find((c) => c.id === clientId);
  const form = useForm(
    (): AdjustmentDraft => ({ direction: 'decrease', amount: '', date: todayISO(), note: '' }),
    useCallback((d: AdjustmentDraft) => validateAdjustment(d), []),
  );
  const { draft, set, errors } = form;
  const balance = clientBalance(data, clientId);
  const amount = parseMoney(draft.amount);
  const after = amount !== null ? balance + (draft.direction === 'increase' ? amount : -amount) : null;

  const save = () => {
    const input = form.submit();
    if (!input) return;
    const error = commit((d, ctx) => registerAdjustment(d, clientId, input, ctx));
    if (error) {
      toast.error('No se registró el ajuste', error);
      return;
    }
    toast.success('Ajuste registrado', `${client?.name ?? ''}: saldo ${formatMoney(balance + input.amount)}.`);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Registrar ajuste"
      subtitle={client?.name}
      onSubmit={save}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" className="btn--grow-mobile">
            Registrar ajuste
          </Button>
        </>
      }
    >
      <FormErrorSummary count={form.errorCount} />
      <div className="form-group">
        <Segmented
          label="Tipo de ajuste"
          value={draft.direction}
          onChange={(v) => set('direction', v)}
          options={[
            { value: 'decrease', label: 'Reducir saldo' },
            { value: 'increase', label: 'Aumentar saldo' },
          ]}
        />
        <div className="form-row">
          <MoneyField label="Importe" value={draft.amount} onValueChange={(v) => set('amount', v)} error={errors.amount} data-autofocus />
          <TextField label="Fecha" type="date" value={draft.date} onValueChange={(v) => set('date', v)} error={errors.date} />
        </div>
        <TextAreaField
          label="Motivo"
          value={draft.note}
          onValueChange={(v) => set('note', v)}
          error={errors.note}
          placeholder="Ej. descuento acordado, corrección de captura"
        />
        <div className="total-line">
          <span className="total-line__label">Saldo resultante</span>
          <strong className="total-line__value num">{after !== null ? formatMoney(after) : formatMoney(balance)}</strong>
        </div>
      </div>
    </Sheet>
  );
}

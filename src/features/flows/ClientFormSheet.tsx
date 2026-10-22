import { Info } from 'lucide-react';
import { useCallback } from 'react';
import { centsToInput, parseMoney } from '../../domain/money';
import { createClient, updateClient } from '../../domain/operations';
import { validateClient, type ClientDraft } from '../../domain/validation';
import { formatMoney } from '../../lib/format';
import { useForm } from '../../lib/useForm';
import { useStore } from '../../store/StoreProvider';
import { Button } from '../../ui/Button';
import { FormErrorSummary, MoneyField, TextAreaField, TextField } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

interface Props {
  clientId?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function ClientFormSheet({ clientId, onClose, onCreated }: Props) {
  const { data, commit } = useStore();
  const toast = useToast();
  const existing = data.clients.find((c) => c.id === clientId);
  const form = useForm(
    (): ClientDraft => ({
      name: existing?.name ?? '',
      phone: existing?.phone ?? '',
      email: existing?.email ?? '',
      pricePerCredit: existing ? centsToInput(existing.pricePerCredit) : '',
      notes: existing?.notes ?? '',
    }),
    useCallback((d: ClientDraft) => validateClient(d), []),
  );
  const { draft, set, errors } = form;
  const newPrice = parseMoney(draft.pricePerCredit);
  const priceChanged = existing && newPrice !== null && newPrice !== existing.pricePerCredit;

  const save = () => {
    const input = form.submit();
    if (!input) return;
    let createdId = '';
    const error = commit((d, ctx) => {
      if (existing) return updateClient(d, existing.id, input, ctx);
      const r = createClient(d, input, ctx);
      createdId = r.client.id;
      return r.data;
    });
    if (error) {
      toast.error('No se guardó el cliente', error);
      return;
    }
    toast.success(
      existing ? 'Cliente actualizado' : 'Cliente agregado',
      priceChanged ? `Nuevo precio: ${formatMoney(input.pricePerCredit)} por crédito.` : input.name,
    );
    if (createdId && onCreated) onCreated(createdId);
    else onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? 'Editar cliente' : 'Nuevo cliente'}
      onSubmit={save}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" className="btn--grow-mobile">
            {existing ? 'Guardar cambios' : 'Agregar cliente'}
          </Button>
        </>
      }
    >
      <FormErrorSummary count={form.errorCount} />
      <div className="form-group">
        <TextField
          label="Nombre"
          value={draft.name}
          onValueChange={(v) => set('name', v)}
          error={errors.name}
          autoComplete="off"
          autoCapitalize="words"
          data-autofocus
        />
        <div className="form-row">
          <TextField
            label="Teléfono"
            type="tel"
            inputMode="tel"
            value={draft.phone}
            onValueChange={(v) => set('phone', v)}
            error={errors.phone}
            autoComplete="off"
          />
          <TextField
            label="Correo"
            optional
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={draft.email}
            onValueChange={(v) => set('email', v)}
            error={errors.email}
            autoComplete="off"
          />
        </div>
        <MoneyField
          label="Precio habitual por crédito"
          value={draft.pricePerCredit}
          onValueChange={(v) => set('pricePerCredit', v)}
          error={errors.pricePerCredit}
          hint="Se precarga en cada servicio nuevo y puede cambiarse por operación."
        />
        {priceChanged && (
          <p className="callout callout--blue" role="status">
            <Info size={18} aria-hidden />
            <span>
              El nuevo precio solo aplica a operaciones futuras. Los movimientos anteriores conservan el precio con el que se registraron (
              {formatMoney(existing.pricePerCredit)}).
            </span>
          </p>
        )}
        <TextAreaField label="Notas" optional value={draft.notes} onValueChange={(v) => set('notes', v)} />
      </div>
    </Sheet>
  );
}

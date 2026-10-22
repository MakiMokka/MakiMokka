import { useCallback } from 'react';
import { createAccount, updateAccount } from '../../domain/operations';
import { validateAccount, type AccountDraft } from '../../domain/validation';
import { useForm } from '../../lib/useForm';
import { useStore } from '../../store/StoreProvider';
import { Button } from '../../ui/Button';
import { FormErrorSummary, SelectField, TextAreaField, TextField } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

interface Props {
  accountId?: string;
  clientId?: string;
  onClose: () => void;
}

export function AccountFormSheet({ accountId, clientId, onClose }: Props) {
  const { data, commit } = useStore();
  const toast = useToast();
  const existing = data.accounts.find((a) => a.id === accountId);
  const validate = useCallback((d: AccountDraft) => validateAccount(d, data, existing?.id), [data, existing?.id]);
  const form = useForm(
    (): AccountDraft => ({
      clientId: existing?.clientId ?? clientId ?? '',
      alias: existing?.alias ?? '',
      username: existing?.username ?? '',
      plan: existing?.plan ?? '',
      expiresAt: existing?.expiresAt ?? '',
      notes: existing?.notes ?? '',
    }),
    validate,
  );
  const { draft, set, errors } = form;
  const clients = data.clients.filter((c) => !c.archived || c.id === draft.clientId).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const save = () => {
    const input = form.submit();
    if (!input) return;
    const operator = data.settings.operatorName;
    const error = commit((d, ctx) =>
      existing ? updateAccount(d, existing.id, input, ctx, operator) : createAccount(d, input, ctx, operator).data,
    );
    if (error) {
      toast.error('No se guardó la cuenta', error);
      return;
    }
    toast.success(existing ? 'Cuenta actualizada' : 'Cuenta agregada', input.alias);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? 'Editar cuenta' : 'Nueva cuenta'}
      onSubmit={save}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" className="btn--grow-mobile">
            {existing ? 'Guardar cambios' : 'Agregar cuenta'}
          </Button>
        </>
      }
    >
      <FormErrorSummary count={form.errorCount} />
      <div className="form-group">
        <SelectField
          label="Cliente"
          value={draft.clientId}
          onValueChange={(v) => set('clientId', v)}
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
        <TextField
          label="Alias o nombre de la cuenta"
          value={draft.alias}
          onValueChange={(v) => set('alias', v)}
          error={errors.alias}
          autoComplete="off"
          placeholder="Ej. Sala, Recámara"
        />
        <TextField
          label="Usuario o identificador"
          value={draft.username}
          onValueChange={(v) => set('username', v)}
          error={errors.username}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <div className="form-row">
          <TextField label="Versión o plan" optional value={draft.plan} onValueChange={(v) => set('plan', v)} autoComplete="off" />
          <TextField
            label="Vencimiento en el portal"
            optional
            type="date"
            value={draft.expiresAt}
            onValueChange={(v) => set('expiresAt', v)}
            error={errors.expiresAt}
            hint={existing ? 'Si lo corriges, el cambio queda en el historial.' : 'Solo si la cuenta ya tiene créditos asignados.'}
          />
        </div>
        <TextAreaField label="Notas" optional value={draft.notes} onValueChange={(v) => set('notes', v)} />
      </div>
    </Sheet>
  );
}

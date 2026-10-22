import { useState } from 'react';
import { todayISO } from '../../domain/dates';
import { cancelService } from '../../domain/operations';
import { formatCredits, formatMoney } from '../../lib/format';
import { useStore } from '../../store/StoreProvider';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { TextField } from '../../ui/Field';
import { useToast } from '../../ui/Toast';

/** Confirmación antes de cancelar un servicio pendiente de asignar. */
export function useCancelService() {
  const { data, commit } = useStore();
  const toast = useToast();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const service = data.services.find((s) => s.id === serviceId);
  const account = data.accounts.find((a) => a.id === service?.accountId);

  const close = () => {
    setServiceId(null);
    setReason('');
  };

  const dialog = (
    <ConfirmDialog
      open={Boolean(service)}
      title="¿Cancelar este servicio?"
      message={
        service && (
          <>
            Se anulará el cargo de {formatMoney(service.total)} por {formatCredits(service.credits)} para {account?.alias ?? 'la cuenta'}.
            Los pagos ya registrados se conservan como saldo a favor del cliente. Esta acción queda en el historial.
          </>
        )
      }
      confirmLabel="Cancelar servicio"
      cancelLabel="Conservar"
      destructive
      onCancel={close}
      onConfirm={() => {
        if (!serviceId) return;
        const error = commit((d, ctx) => cancelService(d, serviceId, reason.trim(), todayISO(), ctx));
        if (error) toast.error('No se canceló el servicio', error);
        else toast.success('Servicio cancelado', 'El cargo se anuló y el saldo se recalculó.');
        close();
      }}
    >
      <TextField label="Motivo" optional value={reason} onValueChange={setReason} autoComplete="off" />
    </ConfirmDialog>
  );

  return { request: setServiceId, dialog };
}

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AccountFormSheet } from './AccountFormSheet';
import { AdjustmentSheet } from './AdjustmentSheet';
import { ClientFormSheet } from './ClientFormSheet';
import { ConfirmAssignmentSheet } from './ConfirmAssignmentSheet';
import { RegisterPaymentSheet } from './RegisterPaymentSheet';
import { RegisterServiceSheet } from './RegisterServiceSheet';
import { SettingsSheet } from './SettingsSheet';

export type Flow =
  | { type: 'service'; clientId?: string; accountId?: string; renewal?: boolean }
  | { type: 'assign'; serviceId: string }
  | { type: 'payment'; clientId?: string; chargeIds?: string[] }
  | { type: 'client'; clientId?: string; thenService?: boolean }
  | { type: 'account'; accountId?: string; clientId?: string }
  | { type: 'adjust'; clientId: string }
  | { type: 'settings' };

interface FlowApi {
  open: (flow: Flow) => void;
  close: () => void;
}

const FlowContext = createContext<FlowApi | null>(null);

/** Aloja las hojas de captura. Solo una está abierta a la vez. */
export function FlowProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [key, setKey] = useState(0);
  const open = useCallback((f: Flow) => {
    setFlow(f);
    setKey((k) => k + 1);
  }, []);
  const close = useCallback(() => setFlow(null), []);
  const api = useMemo(() => ({ open, close }), [open, close]);

  return (
    <FlowContext.Provider value={api}>
      {children}
      {flow?.type === 'service' && <RegisterServiceSheet key={key} {...flow} onClose={close} />}
      {flow?.type === 'assign' && <ConfirmAssignmentSheet key={key} serviceId={flow.serviceId} onClose={close} />}
      {flow?.type === 'payment' && <RegisterPaymentSheet key={key} {...flow} onClose={close} />}
      {flow?.type === 'client' && (
        <ClientFormSheet
          key={key}
          clientId={flow.clientId}
          onClose={close}
          onCreated={flow.thenService ? (id) => open({ type: 'service', clientId: id }) : undefined}
        />
      )}
      {flow?.type === 'account' && <AccountFormSheet key={key} {...flow} onClose={close} />}
      {flow?.type === 'adjust' && <AdjustmentSheet key={key} clientId={flow.clientId} onClose={close} />}
      {flow?.type === 'settings' && <SettingsSheet key={key} onClose={close} />}
    </FlowContext.Provider>
  );
}

export function useFlows(): FlowApi {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error('useFlows debe usarse dentro de FlowProvider');
  return ctx;
}

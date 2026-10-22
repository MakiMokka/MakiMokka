/**
 * Transiciones de estado puras. Cada operación recibe los datos actuales y
 * devuelve una copia nueva; nunca modifica movimientos históricos.
 */
import { chargeStatuses, distributePayment } from './ledger';
import type { Account, AppData, Client, Movement, Service } from './types';
import type { AccountInput, AdjustmentInput, AssignmentInput, ClientInput, PaymentInput, ServiceInput } from './validation';

export class DomainError extends Error {}

export interface OpContext {
  now: Date;
  newId: () => string;
}

export const defaultContext = (): OpContext => ({
  now: new Date(),
  newId: () => crypto.randomUUID(),
});

function findClient(data: AppData, id: string): Client {
  const c = data.clients.find((x) => x.id === id);
  if (!c) throw new DomainError('El cliente ya no existe.');
  return c;
}

function findAccount(data: AppData, id: string): Account {
  const a = data.accounts.find((x) => x.id === id);
  if (!a) throw new DomainError('La cuenta ya no existe.');
  return a;
}

function findService(data: AppData, id: string): Service {
  const s = data.services.find((x) => x.id === id);
  if (!s) throw new DomainError('El servicio ya no existe.');
  return s;
}

function baseMovement(ctx: OpContext, partial: Pick<Movement, 'clientId' | 'type' | 'date' | 'amount'> & Partial<Movement>): Movement {
  return {
    id: ctx.newId(),
    accountId: null,
    credits: null,
    unitPrice: null,
    serviceId: null,
    method: null,
    reference: '',
    note: '',
    allocations: [],
    cancelsChargeId: null,
    createdAt: ctx.now.toISOString(),
    ...partial,
  };
}

/* ---------- Clientes ---------- */

export function createClient(data: AppData, input: ClientInput, ctx: OpContext): { data: AppData; client: Client } {
  const at = ctx.now.toISOString();
  const client: Client = {
    id: ctx.newId(),
    ...input,
    priceHistory: [{ price: input.pricePerCredit, changedAt: at }],
    archived: false,
    createdAt: at,
  };
  return { data: { ...data, clients: [...data.clients, client] }, client };
}

/** Actualiza datos del cliente. Cambiar el precio habitual solo afecta operaciones futuras. */
export function updateClient(data: AppData, id: string, input: ClientInput, ctx: OpContext): AppData {
  const current = findClient(data, id);
  const priceChanged = current.pricePerCredit !== input.pricePerCredit;
  const updated: Client = {
    ...current,
    ...input,
    priceHistory: priceChanged
      ? [...current.priceHistory, { price: input.pricePerCredit, changedAt: ctx.now.toISOString() }]
      : current.priceHistory,
  };
  return { ...data, clients: data.clients.map((c) => (c.id === id ? updated : c)) };
}

export function setClientArchived(data: AppData, id: string, archived: boolean): AppData {
  findClient(data, id);
  return { ...data, clients: data.clients.map((c) => (c.id === id ? { ...c, archived } : c)) };
}

/* ---------- Cuentas ---------- */

export function createAccount(data: AppData, input: AccountInput, ctx: OpContext, operator = ''): { data: AppData; account: Account } {
  findClient(data, input.clientId);
  const at = ctx.now.toISOString();
  const account: Account = {
    id: ctx.newId(),
    ...input,
    expiryHistory: input.expiresAt ? [{ previous: null, next: input.expiresAt, serviceId: null, changedAt: at, changedBy: operator }] : [],
    archived: false,
    createdAt: at,
  };
  return { data: { ...data, accounts: [...data.accounts, account] }, account };
}

/** Edita datos descriptivos; si se corrige el vencimiento, queda en el historial. */
export function updateAccount(data: AppData, id: string, input: AccountInput, ctx: OpContext, operator = ''): AppData {
  const current = findAccount(data, id);
  findClient(data, input.clientId);
  const expiryChanged = input.expiresAt !== current.expiresAt && input.expiresAt !== null;
  const updated: Account = {
    ...current,
    ...input,
    expiresAt: input.expiresAt ?? current.expiresAt,
    expiryHistory: expiryChanged
      ? [
          ...current.expiryHistory,
          {
            previous: current.expiresAt,
            next: input.expiresAt as string,
            serviceId: null,
            changedAt: ctx.now.toISOString(),
            changedBy: operator,
          },
        ]
      : current.expiryHistory,
  };
  return { ...data, accounts: data.accounts.map((a) => (a.id === id ? updated : a)) };
}

export function setAccountArchived(data: AppData, id: string, archived: boolean): AppData {
  findAccount(data, id);
  return { ...data, accounts: data.accounts.map((a) => (a.id === id ? { ...a, archived } : a)) };
}

export function canDeleteAccount(data: AppData, id: string): boolean {
  return !data.services.some((s) => s.accountId === id) && !data.movements.some((m) => m.accountId === id);
}

export function deleteAccount(data: AppData, id: string): AppData {
  findAccount(data, id);
  if (!canDeleteAccount(data, id)) {
    throw new DomainError('La cuenta tiene movimientos registrados. Archívala para conservar el historial.');
  }
  return { ...data, accounts: data.accounts.filter((a) => a.id !== id) };
}

/* ---------- Servicios ---------- */

/**
 * Registra una solicitud de créditos: genera el cargo con el precio aplicado y,
 * si hubo pago, el abono correspondiente. No modifica el vencimiento de la cuenta:
 * eso ocurre solo al confirmar la asignación en el portal.
 */
export function registerService(data: AppData, input: ServiceInput, ctx: OpContext): { data: AppData; service: Service } {
  findClient(data, input.clientId);
  let next = data;
  let accountId = input.accountId;
  if (input.newAccount) {
    const created = createAccount(next, { clientId: input.clientId, ...input.newAccount, expiresAt: null, notes: '' }, ctx);
    next = created.data;
    accountId = created.account.id;
  }
  if (!accountId) throw new DomainError('Selecciona una cuenta.');
  const account = findAccount(next, accountId);
  if (account.clientId !== input.clientId) throw new DomainError('La cuenta no pertenece al cliente.');
  if (!Number.isInteger(input.credits) || input.credits < 1) throw new DomainError('La cantidad de créditos no es válida.');

  const total = Math.round(input.credits * input.unitPrice);
  if (input.amountPaid > total) throw new DomainError('El pago supera el total del servicio.');

  const serviceId = ctx.newId();
  const charge = baseMovement(ctx, {
    clientId: input.clientId,
    accountId,
    type: 'charge',
    date: input.requestedOn,
    amount: total,
    credits: input.credits,
    unitPrice: input.unitPrice,
    serviceId,
    note: input.notes,
  });
  const movements = [...next.movements, charge];
  if (input.amountPaid > 0) {
    movements.push(
      baseMovement(ctx, {
        clientId: input.clientId,
        accountId,
        type: 'payment',
        date: input.requestedOn,
        amount: input.amountPaid,
        serviceId,
        method: input.method,
        allocations: [{ chargeId: charge.id, amount: input.amountPaid }],
      }),
    );
  }
  const service: Service = {
    id: serviceId,
    clientId: input.clientId,
    accountId,
    credits: input.credits,
    unitPrice: input.unitPrice,
    total,
    requestedOn: input.requestedOn,
    notes: input.notes,
    chargeId: charge.id,
    assignment: { status: 'pending' },
    createdAt: ctx.now.toISOString(),
  };
  return { data: { ...next, services: [...next.services, service], movements }, service };
}

/**
 * Confirma que los créditos ya se asignaron manualmente en el portal.
 * La fecha de vencimiento capturada del portal es la fuente de verdad.
 */
export function confirmAssignment(data: AppData, serviceId: string, input: AssignmentInput, ctx: OpContext): AppData {
  const service = findService(data, serviceId);
  if (service.assignment.status !== 'pending') {
    throw new DomainError('Este servicio ya no está pendiente de asignar.');
  }
  const account = findAccount(data, service.accountId);
  const at = ctx.now.toISOString();
  const updatedService: Service = {
    ...service,
    assignment: {
      status: 'assigned',
      assignedOn: input.assignedOn,
      portalExpiresAt: input.portalExpiresAt,
      previousExpiresAt: account.expiresAt,
      confirmedBy: input.confirmedBy,
      confirmedAt: at,
      note: input.note || undefined,
    },
  };
  const updatedAccount: Account = {
    ...account,
    expiresAt: input.portalExpiresAt,
    expiryHistory: [
      ...account.expiryHistory,
      { previous: account.expiresAt, next: input.portalExpiresAt, serviceId, changedAt: at, changedBy: input.confirmedBy },
    ],
  };
  return {
    ...data,
    services: data.services.map((s) => (s.id === serviceId ? updatedService : s)),
    accounts: data.accounts.map((a) => (a.id === account.id ? updatedAccount : a)),
    settings: { ...data.settings, operatorName: input.confirmedBy },
  };
}

/** Cancela un servicio aún no asignado. El cargo se anula con un movimiento de cancelación. */
export function cancelService(data: AppData, serviceId: string, reason: string, date: string, ctx: OpContext): AppData {
  const service = findService(data, serviceId);
  if (service.assignment.status !== 'pending') {
    throw new DomainError('Solo se pueden cancelar servicios pendientes de asignar.');
  }
  const at = ctx.now.toISOString();
  const cancellation = baseMovement(ctx, {
    clientId: service.clientId,
    accountId: service.accountId,
    type: 'cancellation',
    date,
    amount: service.total,
    credits: service.credits,
    unitPrice: service.unitPrice,
    serviceId,
    note: reason,
    cancelsChargeId: service.chargeId,
  });
  return {
    ...data,
    services: data.services.map((s) =>
      s.id === serviceId ? { ...s, assignment: { status: 'cancelled', cancelledAt: at, cancelReason: reason } } : s,
    ),
    movements: [...data.movements, cancellation],
  };
}

/* ---------- Pagos y ajustes ---------- */

export function registerPayment(data: AppData, input: PaymentInput, ctx: OpContext): AppData {
  findClient(data, input.clientId);
  if (input.amount <= 0) throw new DomainError('El importe debe ser mayor que cero.');
  let allocations: Movement['allocations'] = [];
  if (input.chargeIds.length > 0) {
    const selected = chargeStatuses(data, input.clientId).filter((c) => input.chargeIds.includes(c.chargeId) && c.outstanding > 0);
    const result = distributePayment(input.amount, selected);
    if (result.unallocated > 0) throw new DomainError('El importe supera lo pendiente de los cargos seleccionados.');
    allocations = result.allocations;
  }
  const accountIds = new Set(allocations.map((a) => data.movements.find((m) => m.id === a.chargeId)?.accountId ?? null));
  const payment = baseMovement(ctx, {
    clientId: input.clientId,
    accountId: accountIds.size === 1 ? ([...accountIds][0] ?? null) : null,
    type: 'payment',
    date: input.date,
    amount: input.amount,
    method: input.method,
    reference: input.reference,
    allocations,
  });
  return { ...data, movements: [...data.movements, payment] };
}

export function registerAdjustment(data: AppData, clientId: string, input: AdjustmentInput, ctx: OpContext): AppData {
  findClient(data, clientId);
  if (input.amount === 0) throw new DomainError('El ajuste no puede ser cero.');
  const adjustment = baseMovement(ctx, {
    clientId,
    type: 'adjustment',
    date: input.date,
    amount: input.amount,
    note: input.note,
  });
  return { ...data, movements: [...data.movements, adjustment] };
}

export function setOperatorName(data: AppData, name: string): AppData {
  return { ...data, settings: { ...data.settings, operatorName: name.trim() } };
}

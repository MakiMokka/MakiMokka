import { isSameMonth } from './dates';
import type { PaymentState } from './status';
import type { AppData, Cents, ISODate, Movement } from './types';

/** Efecto de un movimiento sobre el saldo del cliente (positivo = el cliente debe más). */
export function balanceDelta(m: Movement): Cents {
  switch (m.type) {
    case 'charge':
      return m.amount;
    case 'payment':
    case 'cancellation':
      return -m.amount;
    case 'adjustment':
      return m.amount;
  }
}

/** Orden cronológico estable: fecha de la operación y después momento de captura. */
export function compareMovements(a: Movement, b: Movement): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export function clientMovements(data: AppData, clientId: string): Movement[] {
  return data.movements.filter((m) => m.clientId === clientId).sort(compareMovements);
}

export function clientBalance(data: AppData, clientId: string): Cents {
  return data.movements.filter((m) => m.clientId === clientId).reduce((acc, m) => acc + balanceDelta(m), 0);
}

export interface LedgerRow {
  movement: Movement;
  /** Saldo del cliente inmediatamente después de este movimiento. */
  balanceAfter: Cents;
}

/** Movimientos con su saldo resultante, en orden cronológico por cliente. */
export function ledgerRows(data: AppData, clientId?: string): LedgerRow[] {
  const running = new Map<string, Cents>();
  const ordered = [...data.movements].filter((m) => !clientId || m.clientId === clientId).sort(compareMovements);
  return ordered.map((movement) => {
    const next = (running.get(movement.clientId) ?? 0) + balanceDelta(movement);
    running.set(movement.clientId, next);
    return { movement, balanceAfter: next };
  });
}

export interface ChargeStatus {
  chargeId: string;
  serviceId: string | null;
  accountId: string | null;
  date: ISODate;
  credits: number | null;
  unitPrice: Cents | null;
  amount: Cents;
  cancelled: boolean;
  paid: Cents;
  outstanding: Cents;
}

/**
 * Estado de cada cargo del cliente.
 * Primero se aplican los pagos dirigidos a cargos específicos y después,
 * en orden de antigüedad, el resto de abonos (pagos generales y ajustes a favor).
 */
export function chargeStatuses(data: AppData, clientId: string): ChargeStatus[] {
  const movements = clientMovements(data, clientId);
  const cancelled = new Set(
    movements.filter((m) => m.type === 'cancellation' && m.cancelsChargeId).map((m) => m.cancelsChargeId as string),
  );
  const charges: ChargeStatus[] = movements
    .filter((m) => m.type === 'charge')
    .map((m) => ({
      chargeId: m.id,
      serviceId: m.serviceId,
      accountId: m.accountId,
      date: m.date,
      credits: m.credits,
      unitPrice: m.unitPrice,
      amount: m.amount,
      cancelled: cancelled.has(m.id),
      paid: 0,
      outstanding: cancelled.has(m.id) ? 0 : m.amount,
    }));
  const byId = new Map(charges.map((c) => [c.chargeId, c]));

  let pool: Cents = 0;
  for (const m of movements) {
    if (m.type === 'payment') {
      let remaining = m.amount;
      for (const a of m.allocations) {
        const charge = byId.get(a.chargeId);
        if (!charge || charge.cancelled) continue;
        const applied = Math.min(a.amount, charge.outstanding, remaining);
        charge.paid += applied;
        charge.outstanding -= applied;
        remaining -= applied;
      }
      pool += remaining;
    } else if (m.type === 'adjustment' && m.amount < 0) {
      pool += -m.amount;
    }
  }
  for (const charge of charges) {
    if (pool <= 0) break;
    if (charge.outstanding <= 0) continue;
    const applied = Math.min(pool, charge.outstanding);
    charge.paid += applied;
    charge.outstanding -= applied;
    pool -= applied;
  }
  return charges;
}

export function openCharges(data: AppData, clientId: string): ChargeStatus[] {
  return chargeStatuses(data, clientId).filter((c) => c.outstanding > 0);
}

export interface ClientSummary {
  clientId: string;
  totalCharges: Cents;
  totalPaid: Cents;
  totalAdjustments: Cents;
  balance: Cents;
  lastPayment: Movement | null;
  paymentState: PaymentState | null;
}

export function clientSummary(data: AppData, clientId: string): ClientSummary {
  const movements = clientMovements(data, clientId);
  let totalCharges = 0;
  let totalPaid = 0;
  let totalAdjustments = 0;
  let lastPayment: Movement | null = null;
  for (const m of movements) {
    if (m.type === 'charge') totalCharges += m.amount;
    if (m.type === 'cancellation') totalCharges -= m.amount;
    if (m.type === 'adjustment') totalAdjustments += m.amount;
    if (m.type === 'payment') {
      totalPaid += m.amount;
      lastPayment = m;
    }
  }
  const balance = totalCharges + totalAdjustments - totalPaid;
  return {
    clientId,
    totalCharges,
    totalPaid,
    totalAdjustments,
    balance,
    lastPayment,
    paymentState: movements.length === 0 ? null : paymentState(data, clientId, balance),
  };
}

function paymentState(data: AppData, clientId: string, balance: Cents): PaymentState {
  if (balance < 0) return 'credit';
  if (balance === 0) return 'paid';
  const open = openCharges(data, clientId);
  return open.some((c) => c.paid > 0) ? 'partial' : 'pending';
}

export function totalReceivable(data: AppData): Cents {
  return data.clients.reduce((acc, c) => acc + Math.max(0, clientBalance(data, c.id)), 0);
}

export function paymentsInMonth(data: AppData, month: ISODate): Cents {
  return data.movements.filter((m) => m.type === 'payment' && isSameMonth(m.date, month)).reduce((acc, m) => acc + m.amount, 0);
}

/**
 * Reparte un pago entre los cargos seleccionados, del más antiguo al más reciente,
 * sin exceder lo pendiente de cada uno.
 */
export function distributePayment(
  amount: Cents,
  charges: ChargeStatus[],
): { allocations: { chargeId: string; amount: Cents }[]; unallocated: Cents } {
  let remaining = amount;
  const allocations: { chargeId: string; amount: Cents }[] = [];
  const ordered = [...charges].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const c of ordered) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, c.outstanding);
    if (applied > 0) {
      allocations.push({ chargeId: c.chargeId, amount: applied });
      remaining -= applied;
    }
  }
  return { allocations, unallocated: remaining };
}

/** Estado de todos los cargos indexado por id, para consultas repetidas en una misma vista. */
export function chargeStatusMap(data: AppData): Map<string, ChargeStatus> {
  const map = new Map<string, ChargeStatus>();
  const clientIds = new Set(data.movements.map((m) => m.clientId));
  for (const id of clientIds) for (const c of chargeStatuses(data, id)) map.set(c.chargeId, c);
  return map;
}

export function chargePaymentState(c: ChargeStatus | undefined): PaymentState {
  if (!c || c.outstanding === 0) return 'paid';
  return c.paid > 0 ? 'partial' : 'pending';
}

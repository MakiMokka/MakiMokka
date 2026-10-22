import type { MovementType, PaymentMethod } from './types';

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  deposit: 'Depósito',
  other: 'Otro',
};

export const paymentMethods = Object.keys(paymentMethodLabels) as PaymentMethod[];

export const movementTypeLabels: Record<MovementType, string> = {
  charge: 'Cargo',
  payment: 'Pago',
  adjustment: 'Ajuste',
  cancellation: 'Cancelación',
};

/** Un crédito equivale a 30 días de servicio (referencia informativa; el portal manda). */
export const DAYS_PER_CREDIT = 30;

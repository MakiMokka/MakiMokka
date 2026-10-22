import { daysBetween } from './dates';
import type { AssignmentStatus, ISODate } from './types';

/** Tonos semánticos de la paleta. La presentación decide cómo pintarlos. */
export type Tone = 'coral' | 'yellow' | 'green' | 'blue' | 'neutral';
export type Emphasis = 'solid' | 'soft';

export type ExpiryKind = 'none' | 'expired' | 'today' | 'critical' | 'soon' | 'ok';

export interface ExpiryStatus {
  kind: ExpiryKind;
  days: number | null;
  tone: Tone;
  emphasis: Emphasis;
  label: string;
}

/** Calcula el estado de vencimiento a partir de la fecha del portal y la fecha de hoy. */
export function expiryStatus(expiresAt: ISODate | null, today: ISODate): ExpiryStatus {
  if (!expiresAt) {
    return { kind: 'none', days: null, tone: 'neutral', emphasis: 'soft', label: 'Sin vencimiento' };
  }
  const days = daysBetween(today, expiresAt);
  if (days < 0) {
    const n = Math.abs(days);
    return {
      kind: 'expired',
      days,
      tone: 'coral',
      emphasis: 'solid',
      label: n === 1 ? 'Venció ayer' : `Venció hace ${n} días`,
    };
  }
  if (days === 0) return { kind: 'today', days, tone: 'coral', emphasis: 'solid', label: 'Vence hoy' };
  if (days <= 3) {
    return {
      kind: 'critical',
      days,
      tone: 'coral',
      emphasis: 'soft',
      label: days === 1 ? 'Vence mañana' : `Vence en ${days} días`,
    };
  }
  if (days <= 7) return { kind: 'soon', days, tone: 'yellow', emphasis: 'soft', label: `Vence en ${days} días` };
  return { kind: 'ok', days, tone: 'green', emphasis: 'soft', label: 'Activa' };
}

export function formatDaysRemaining(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'Hoy';
  if (days === 1) return '1 día';
  if (days === -1) return '−1 día';
  return days < 0 ? `−${Math.abs(days)} días` : `${days} días`;
}

export type PaymentState = 'paid' | 'partial' | 'pending' | 'credit';

export interface StatusDescriptor {
  tone: Tone;
  emphasis: Emphasis;
  label: string;
}

export const paymentStateDescriptor: Record<PaymentState, StatusDescriptor> = {
  pending: { tone: 'coral', emphasis: 'soft', label: 'Pago pendiente' },
  partial: { tone: 'yellow', emphasis: 'soft', label: 'Pago parcial' },
  paid: { tone: 'green', emphasis: 'soft', label: 'Pagado' },
  credit: { tone: 'blue', emphasis: 'soft', label: 'Saldo a favor' },
};

export const assignmentDescriptor: Record<AssignmentStatus, StatusDescriptor> = {
  pending: { tone: 'yellow', emphasis: 'soft', label: 'Por asignar' },
  assigned: { tone: 'green', emphasis: 'soft', label: 'Asignado' },
  cancelled: { tone: 'neutral', emphasis: 'soft', label: 'Cancelado' },
};

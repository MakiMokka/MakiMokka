// Tipos de dominio compartidos por todos los módulos. No dependen de Playwright ni de la base de datos.

/** Fecha ISO local del restaurante (YYYY-MM-DD). */
export type IsoDate = string;
/** Hora local del restaurante (HH:mm, 24h). */
export type HHmm = string;

export type SlotStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'NOT_YET_RELEASED'
  | 'SOLD_OUT'
  | 'UNKNOWN'
  | 'ERROR';

export interface Slot {
  date: IsoDate;
  time: HHmm;
  partySize: number;
  status: SlotStatus;
  /** Texto o id con el que el adapter puede volver a encontrar el horario en la página. */
  handle?: string;
}

export interface DateAvailability {
  date: IsoDate;
  /** Estado agregado de la fecha. AVAILABLE si hay al menos un horario disponible. */
  status: SlotStatus;
  slots: Slot[];
  checkedAt: string;
  /** Detalle técnico (sin datos personales) cuando status es UNKNOWN o ERROR. */
  detail?: string;
}

export interface Target {
  date: IsoDate;
  /** 1 = máxima prioridad. */
  priority: number;
  label: string;
  /** Hora mínima aceptable (inclusive). */
  minTime?: HHmm;
  /** Hora máxima aceptable (inclusive). */
  maxTime?: HHmm;
  /** Horarios en orden de preferencia; si está vacío se toma el primero disponible. */
  preferredTimes?: HHmm[];
  /** Horarios publicados de referencia (solo informativo; la disponibilidad real manda). */
  referenceTimes?: HHmm[];
}

export interface Guest {
  fullName: string;
  phone: string;
  email: string;
  partySize: number;
  /** Respuesta a "¿Festejas algo?". Solo se admite "No" salvo configuración explícita. */
  celebration: 'No';
}

export interface Candidate {
  slot: Slot;
  target: Target;
  /** Menor es mejor. */
  rank: number;
}

export type BookingOutcome =
  | { kind: 'CONFIRMED'; confirmationId: string; evidence: string }
  | { kind: 'SLOT_GONE'; detail?: string }
  | { kind: 'HUMAN_ACTION_REQUIRED'; reason: string }
  | { kind: 'PAYMENT_REQUIRED'; detail: string }
  | { kind: 'SESSION_EXPIRED' }
  | { kind: 'RATE_LIMITED'; retryAfterMs?: number }
  /** Se envió el formulario pero no hay evidencia verificable de confirmación. Bloquea nuevos intentos. */
  | { kind: 'UNCERTAIN'; detail: string }
  /** Modo asistido o adapter no verificado: formulario listo, no se envió. */
  | { kind: 'READY_NOT_SUBMITTED'; detail: string }
  | { kind: 'FAILED'; error: string };

export interface Reservation {
  campaignId: string;
  restaurant: string;
  date: IsoDate;
  time: HHmm;
  partySize: number;
  guestName: string;
  confirmationId: string;
  status: 'CONFIRMED';
  confirmedAt: string;
  evidence: string;
}

export type AttemptStatus =
  | 'PENDING'
  | 'FILLING'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'SLOT_GONE'
  | 'UNCERTAIN'
  | 'HUMAN_ACTION_REQUIRED'
  | 'FAILED'
  | 'NOT_SUBMITTED';

export interface Attempt {
  id: string;
  campaignId: string;
  date: IsoDate;
  time: HHmm;
  status: AttemptStatus;
  createdAt: string;
  updatedAt: string;
  detail?: string;
}

export type Mode = 'AUTO' | 'ASSISTED';

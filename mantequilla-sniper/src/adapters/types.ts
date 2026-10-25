import type { BookingOutcome, DateAvailability, Guest, IsoDate, Slot } from '../core/types.js';

export interface BookOptions {
  /** false = llenar todo y detenerse antes de enviar (modo asistido / adapter sin verificar). */
  submit: boolean;
  /**
   * Se invoca justo antes del clic final de envío. Debe persistir el intento como SUBMITTED;
   * si lanza, el adapter NO envía. Es la base de la prevención de duplicados.
   */
  beforeSubmit: () => Promise<void>;
  signal?: AbortSignal;
}

export interface HealthResult {
  ok: boolean;
  detail: string;
  /** La plataforma pide CAPTCHA, login u otra acción humana. */
  humanActionRequired?: boolean;
  sessionExpired?: boolean;
  rateLimited?: boolean;
}

/** Contrato que cualquier plataforma de reservaciones debe implementar. */
export interface RestaurantAdapter {
  readonly name: string;
  /** Lanza el navegador y abre la página del restaurante. Idempotente. */
  init(): Promise<void>;
  /** Deja la página lista para consultar (p. ej. 2 personas seleccionadas). */
  prepare(partySize: number): Promise<void>;
  healthCheck(): Promise<HealthResult>;
  checkDates(dates: IsoDate[], partySize: number): Promise<DateAvailability[]>;
  book(slot: Slot, guest: Guest, opts: BookOptions): Promise<BookingOutcome>;
  /** Link para que una persona complete esta reserva en su navegador (prellenado si la plataforma lo permite). */
  deepLink?(slot: Slot, guest: Guest): string;
  close(): Promise<void>;
}

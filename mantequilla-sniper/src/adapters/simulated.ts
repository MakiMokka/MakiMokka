import type { BookingOutcome, DateAvailability, Guest, HHmm, IsoDate, Slot, SlotStatus } from '../core/types.js';
import type { BookOptions, HealthResult, RestaurantAdapter } from './types.js';

export interface SimDay {
  status?: SlotStatus;
  /** Horarios disponibles para el tamaño de grupo consultado. */
  available?: HHmm[];
  soldOut?: HHmm[];
}

export type SimBookBehavior =
  | 'confirm'
  | 'gone'
  | 'captcha'
  | 'payment'
  | 'disconnect_after_submit'
  | 'session_expired';

/**
 * Plataforma simulada en memoria: permite escribir escenarios de prueba sin tocar
 * CoverManager y sin crear reservaciones reales.
 */
export class SimulatedAdapter implements RestaurantAdapter {
  readonly name = 'simulated';
  days = new Map<IsoDate, SimDay>();
  /** Comportamiento por "fecha hora"; por defecto confirma. */
  behavior = new Map<string, SimBookBehavior>();
  health: HealthResult = { ok: true, detail: 'ok' };
  /** Reservas que la plataforma simulada realmente registró (para detectar duplicados). */
  readonly platformBookings: Array<{ date: IsoDate; time: HHmm; name: string }> = [];
  readonly calls = { init: 0, prepare: 0, check: 0, book: 0, submit: 0 };
  checkError: Error | null = null;
  private seq = 1000;

  setDay(date: IsoDate, day: SimDay): this {
    this.days.set(date, day);
    return this;
  }

  async init() {
    this.calls.init++;
  }
  async prepare() {
    this.calls.prepare++;
  }
  async healthCheck() {
    return this.health;
  }
  async close() {}

  async checkDates(dates: IsoDate[], partySize: number): Promise<DateAvailability[]> {
    this.calls.check++;
    if (this.checkError) throw this.checkError;
    const now = new Date().toISOString();
    return dates.map((date) => {
      const d = this.days.get(date) ?? { status: 'NOT_YET_RELEASED' as const };
      const slots: Slot[] = [
        ...(d.available ?? []).map((time) => ({ date, time, partySize, status: 'AVAILABLE' as const })),
        ...(d.soldOut ?? []).map((time) => ({ date, time, partySize, status: 'SOLD_OUT' as const })),
      ];
      return { date, status: d.status ?? (slots.length ? 'UNAVAILABLE' : 'SOLD_OUT'), slots, checkedAt: now };
    });
  }

  async book(slot: Slot, guest: Guest, opts: BookOptions): Promise<BookingOutcome> {
    this.calls.book++;
    const key = `${slot.date} ${slot.time}`;
    const behavior = this.behavior.get(key) ?? 'confirm';
    const day = this.days.get(slot.date);
    const stillThere = day?.available?.includes(slot.time) ?? false;
    if (behavior === 'gone' || !stillThere) {
      this.removeSlot(slot);
      return { kind: 'SLOT_GONE', detail: 'Horario ya no disponible' };
    }
    if (behavior === 'captcha') return { kind: 'HUMAN_ACTION_REQUIRED', reason: 'CAPTCHA en el formulario' };
    if (behavior === 'payment') return { kind: 'PAYMENT_REQUIRED', detail: 'Depósito de garantía con tarjeta' };
    if (behavior === 'session_expired') return { kind: 'SESSION_EXPIRED' };
    if (!opts.submit) return { kind: 'READY_NOT_SUBMITTED', detail: 'Formulario listo, envío deshabilitado' };

    await opts.beforeSubmit();
    this.calls.submit++;
    this.platformBookings.push({ date: slot.date, time: slot.time, name: guest.fullName });
    this.removeSlot(slot);
    if (behavior === 'disconnect_after_submit') throw new Error('Target page, context or browser has been closed');
    const id = `SIM-${this.seq++}`;
    return { kind: 'CONFIRMED', confirmationId: id, evidence: `Pantalla de confirmación simulada ${id}` };
  }

  private removeSlot(slot: Slot) {
    const day = this.days.get(slot.date);
    if (day?.available) day.available = day.available.filter((t) => t !== slot.time);
  }
}

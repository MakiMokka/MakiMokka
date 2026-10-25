import type { RestaurantAdapter } from '../adapters/types.js';
import { errorMessage, type Logger } from '../core/logger.js';
import type { StateMachine } from '../core/stateMachine.js';
import type { BookingOutcome, Candidate, Guest, Mode, Reservation } from '../core/types.js';
import { successMessage, type Notifier } from '../notify/notifier.js';
import type { Store } from '../store/types.js';

export type BookingResult =
  | { kind: 'CONFIRMED'; reservation: Reservation }
  | { kind: 'ALL_GONE' }
  | { kind: 'HUMAN_ACTION_REQUIRED'; reason: string }
  /** Hay un envío sin verificar: no se permite ningún intento nuevo hasta que una persona lo resuelva. */
  | { kind: 'BLOCKED'; reason: string }
  | { kind: 'LOCKED' }
  | { kind: 'ALREADY_CONFIRMED'; reservation: Reservation }
  | { kind: 'SESSION_EXPIRED' }
  | { kind: 'RATE_LIMITED'; retryAfterMs?: number }
  | { kind: 'FAILED'; error: string };

export interface BookingDeps {
  campaignId: string;
  restaurantName: string;
  restaurantUrl: string;
  timezone: string;
  adapter: RestaurantAdapter;
  store: Store;
  notifier: Notifier;
  sm: StateMachine;
  log: Logger;
  guest: Guest;
  holder: string;
  maxCandidates?: number;
  lockTtlMs?: number;
}

/**
 * Motor de reservaciones. Garantías:
 * - Un solo intento a la vez (lock en el store, no en memoria).
 * - El intento se marca SUBMITTED en el store ANTES del clic de envío.
 * - Si se envió y no hay evidencia de confirmación, el resultado es UNCERTAIN y se bloquea
 *   cualquier intento posterior: nunca se reintenta un envío que pudo haber funcionado.
 * - CONFIRMED solo con identificador/evidencia devueltos por la plataforma.
 */
export class BookingEngine {
  constructor(private readonly d: BookingDeps) {}

  async book(candidates: Candidate[], mode: Mode, adapterVerified: boolean): Promise<BookingResult> {
    const { store, campaignId, holder, log } = this.d;
    const submit = mode === 'AUTO' && adapterVerified;

    if (!(await store.acquireBookingLock(campaignId, holder, this.d.lockTtlMs ?? 5 * 60_000))) return { kind: 'LOCKED' };
    try {
      const existing = await store.getConfirmed(campaignId);
      if (existing) return { kind: 'ALREADY_CONFIRMED', reservation: existing };
      const unresolved = await store.listUnresolvedAttempts(campaignId);
      if (unresolved.length > 0) return { kind: 'BLOCKED', reason: `Intento ${unresolved[0]!.id} sin verificar` };

      for (const c of candidates.slice(0, this.d.maxCandidates ?? 3)) {
        const result = await this.tryOne(c, submit);
        if (result) return result;
      }
      return { kind: 'ALL_GONE' };
    } catch (err) {
      log.error('Error en el motor de reservaciones', { err: errorMessage(err) });
      return { kind: 'FAILED', error: errorMessage(err) };
    } finally {
      await store.releaseBookingLock(campaignId, holder).catch(() => undefined);
    }
  }

  /** Devuelve null para pasar al siguiente candidato (la mesa desapareció antes de enviar). */
  private async tryOne(c: Candidate, submit: boolean): Promise<BookingResult | null> {
    const { store, sm, notifier, adapter, log, campaignId } = this.d;
    const { slot } = c;
    if (sm.state !== 'SLOT_FOUND') await sm.go('SLOT_FOUND', `${slot.date} ${slot.time}`);
    const attempt = await store.createAttempt({ campaignId, date: slot.date, time: slot.time, status: 'PENDING' });
    await sm.go('FILLING_FORM', `Intento ${attempt.id}`);
    await store.updateAttempt(attempt.id, 'FILLING');

    let submitted = false;
    let outcome: BookingOutcome;
    try {
      outcome = await adapter.book(slot, this.d.guest, {
        submit,
        beforeSubmit: async () => {
          await store.updateAttempt(attempt.id, 'SUBMITTED');
          submitted = true;
          await sm.go('AWAITING_CONFIRMATION', `Formulario enviado (${slot.date} ${slot.time})`);
        },
      });
    } catch (err) {
      outcome = { kind: 'FAILED', error: errorMessage(err) };
    }

    // Un envío sin confirmación verificable nunca se trata como fallo reintentable.
    if (submitted && outcome.kind !== 'CONFIRMED' && outcome.kind !== 'SLOT_GONE') {
      const detail = outcome.kind === 'FAILED' ? outcome.error : outcome.kind;
      outcome = { kind: 'UNCERTAIN', detail: `Enviado sin confirmación verificable: ${detail}` };
    }

    log.info('Resultado de intento', { attempt: attempt.id, date: slot.date, time: slot.time, outcome: outcome.kind });

    switch (outcome.kind) {
      case 'CONFIRMED': {
        const reservation: Reservation = {
          campaignId,
          restaurant: this.d.restaurantName,
          date: slot.date,
          time: slot.time,
          partySize: slot.partySize,
          guestName: this.d.guest.fullName,
          confirmationId: outcome.confirmationId,
          status: 'CONFIRMED',
          confirmedAt: new Date().toISOString(),
          evidence: outcome.evidence,
        };
        const saved = await store.saveReservation(reservation);
        await store.updateAttempt(attempt.id, 'CONFIRMED', outcome.confirmationId);
        if (sm.state !== 'AWAITING_CONFIRMATION') await sm.go('AWAITING_CONFIRMATION', 'Confirmación recibida');
        await sm.go('CONFIRMED', `Confirmación ${outcome.confirmationId}`);
        if (saved) await notifier.notify(successMessage(reservation, this.d.timezone));
        return { kind: 'CONFIRMED', reservation: saved ? reservation : ((await store.getConfirmed(campaignId)) ?? reservation) };
      }
      case 'SLOT_GONE':
        await store.updateAttempt(attempt.id, 'SLOT_GONE', outcome.detail);
        await sm.go('CHECKING_AVAILABILITY', 'La mesa ya no está disponible');
        return null;
      case 'READY_NOT_SUBMITTED':
        await store.updateAttempt(attempt.id, 'NOT_SUBMITTED', outcome.detail);
        await sm.go('HUMAN_ACTION_REQUIRED', outcome.detail);
        await notifier.notify({
          type: 'HUMAN_ACTION_REQUIRED',
          title: 'Mesa disponible: completa la reserva',
          body: `${c.target.label} ${slot.time} para ${slot.partySize}. ${outcome.detail}`,
          url: adapter.deepLink?.(slot, this.d.guest) ?? this.d.restaurantUrl,
          urgent: true,
          data: { date: slot.date, time: slot.time },
        });
        return { kind: 'HUMAN_ACTION_REQUIRED', reason: outcome.detail };
      case 'HUMAN_ACTION_REQUIRED':
      case 'PAYMENT_REQUIRED': {
        const reason = outcome.kind === 'PAYMENT_REQUIRED' ? `Cargo o depósito no autorizado: ${outcome.detail}` : outcome.reason;
        await store.updateAttempt(attempt.id, 'HUMAN_ACTION_REQUIRED', reason);
        await sm.go('HUMAN_ACTION_REQUIRED', reason);
        await notifier.notify({
          type: 'HUMAN_ACTION_REQUIRED',
          title: 'Acción humana requerida',
          body: `${c.target.label} ${slot.time}: ${reason}`,
          url: adapter.deepLink?.(slot, this.d.guest) ?? this.d.restaurantUrl,
          urgent: true,
          data: { date: slot.date, time: slot.time },
        });
        return { kind: 'HUMAN_ACTION_REQUIRED', reason };
      }
      case 'UNCERTAIN':
        await store.updateAttempt(attempt.id, 'UNCERTAIN', outcome.detail);
        await sm.go('HUMAN_ACTION_REQUIRED', outcome.detail);
        await notifier.notify({
          type: 'HUMAN_ACTION_REQUIRED',
          title: 'Verificar reserva enviada',
          body: `Se envió ${c.target.label} ${slot.time} pero no hubo confirmación verificable. Revisa el correo de CoverManager y resuelve el intento en el dashboard. No se harán más intentos hasta entonces.`,
          urgent: true,
          data: { attemptId: attempt.id, date: slot.date, time: slot.time },
        });
        return { kind: 'BLOCKED', reason: outcome.detail };
      case 'SESSION_EXPIRED':
        await store.updateAttempt(attempt.id, 'FAILED', 'SESSION_EXPIRED');
        await sm.go('SESSION_EXPIRED', 'Sesión expirada durante el formulario');
        return { kind: 'SESSION_EXPIRED' };
      case 'RATE_LIMITED':
        await store.updateAttempt(attempt.id, 'FAILED', 'RATE_LIMITED');
        await sm.go('RATE_LIMITED', 'Límite de solicitudes de la plataforma');
        return { kind: 'RATE_LIMITED', retryAfterMs: outcome.retryAfterMs };
      case 'FAILED':
        await store.updateAttempt(attempt.id, 'FAILED', outcome.error);
        await sm.go('FAILED', outcome.error);
        return { kind: 'FAILED', error: outcome.error };
    }
  }
}

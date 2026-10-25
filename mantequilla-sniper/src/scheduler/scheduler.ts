import type { CampaignConfig } from '../core/config.js';
import { errorMessage, type Logger } from '../core/logger.js';
import type { Notifier } from '../notify/notifier.js';
import type { CycleResult, Orchestrator } from '../orchestrator.js';
import { measureServerOffset, waitUntil, type Clock } from './clock.js';
import { nextRelease, possiblyOpen, type ReleaseOpportunity } from './releaseCalendar.js';

export interface SchedulerDeps {
  campaign: CampaignConfig;
  orch: Orchestrator;
  clock: Clock;
  notifier: Notifier;
  log: Logger;
  /** Mide desfase del reloj; inyectable para pruebas. */
  measureOffset?: () => Promise<{ offsetMs: number; rttMs: number } | null>;
  /** Aplica la corrección al reloj del sistema. */
  applyOffset?: (offsetMs: number) => void;
}

export const PREP_LEAD_MS = 120_000;
export const BROWSER_LEAD_MS = 30_000;
const MAX_TOLERATED_SKEW_MS = 1_000;
const RATE_LIMIT_BACKOFF_MS = 60_000;
const HUMAN_BACKOFF_MS = 60_000;

export type SchedulerExit = 'CONFIRMED' | 'ENDED' | 'STOPPED';

/**
 * Scheduler consciente de zona horaria. Fuera de las aperturas monitorea cancelaciones a baja
 * frecuencia; alrededor de cada apertura ejecuta la secuencia T-120 / T-30 / T=0.
 * No guarda estado propio: tras un reinicio recalcula todo desde el reloj y el store.
 */
export class Scheduler {
  constructor(private readonly d: SchedulerDeps) {}

  async run(signal?: AbortSignal): Promise<SchedulerExit> {
    const { campaign, orch, clock, log } = this.d;
    const poll = campaign.polling;
    while (!signal?.aborted) {
      try {
        const g = await orch.guard();
        if (g === 'DONE') return 'CONFIRMED';
        if (g === 'BLOCKED' || g === 'PAUSED') {
          await clock.sleep(poll.cancellationPollMs, signal);
          continue;
        }
        const active = orch.activeDates();
        if (active.length === 0) {
          await this.d.notifier.notify({
            type: 'WINDOW_ENDED_NO_AVAILABILITY',
            title: 'Búsqueda terminada sin reserva',
            body: 'Ya pasaron todas las fechas objetivo sin conseguir mesa.',
          });
          return 'ENDED';
        }

        const now = clock.now();
        const next = nextRelease(campaign, now);
        orch.nextReleaseAt = next ? new Date(next.at).toISOString() : null;
        if (next && next.at - now <= PREP_LEAD_MS) {
          const r = await this.releaseWindow(next, signal);
          if (r === 'DONE') return 'CONFIRMED';
          continue;
        }

        // Monitoreo de cancelaciones solo para fechas que ya podrían estar abiertas.
        const open = active.filter((dt) => possiblyOpen(campaign, dt, now));
        if (open.length > 0) {
          const r = await orch.runCycle(open);
          if (r === 'DONE') return 'CONFIRMED';
          await this.afterCycle(r, signal);
        }
        await orch.publishStatus();
        const untilPrep = next ? next.at - PREP_LEAD_MS - clock.now() : Infinity;
        await clock.sleep(Math.max(0, Math.min(poll.cancellationPollMs, untilPrep)), signal);
      } catch (err) {
        if (signal?.aborted) break;
        log.error('Error en el ciclo del scheduler', { err: errorMessage(err) });
        await clock.sleep(poll.minIntervalMs * 5, signal).catch(() => undefined);
      }
    }
    return 'STOPPED';
  }

  private async afterCycle(r: CycleResult, signal?: AbortSignal): Promise<void> {
    const { clock, notifier, orch } = this.d;
    if (r === 'RATE_LIMITED') {
      await notifier.notify({ type: 'CRITICAL_ERROR', title: 'Límite de solicitudes', body: 'CoverManager limitó las consultas; se espera antes de reintentar.' });
      await clock.sleep(RATE_LIMIT_BACKOFF_MS, signal);
    } else if (r === 'SESSION_EXPIRED') {
      await orch.initialize();
    } else if (r === 'HUMAN_ACTION_REQUIRED' && orch.sm.state === 'HUMAN_ACTION_REQUIRED') {
      await clock.sleep(HUMAN_BACKOFF_MS, signal);
    }
  }

  /** Secuencia de precisión alrededor de una apertura. */
  async releaseWindow(opp: ReleaseOpportunity, signal?: AbortSignal): Promise<CycleResult> {
    const { campaign, orch, clock, log, notifier } = this.d;
    const poll = campaign.polling;
    const T = opp.at;
    const end = T + poll.releaseWindowSeconds * 1000;
    log.info('Ventana de apertura', { at: opp.atLocal, dates: opp.dates });

    // T-120: reloj, conexión, sesión y configuración.
    if (clock.now() < T - PREP_LEAD_MS) await waitUntil(clock, T - PREP_LEAD_MS, signal);
    if (clock.now() < T) {
      const measured = await (this.d.measureOffset ?? (() => measureServerOffset(campaign.restaurant.url)))();
      if (!measured) {
        await notifier.notify({ type: 'CRITICAL_ERROR', title: 'Sin conexión a CoverManager', body: `No se pudo contactar ${campaign.restaurant.url} antes de la apertura ${opp.atLocal}.`, urgent: true });
      } else {
        orch.clockOffsetMs = Math.round(measured.offsetMs);
        if (Math.abs(measured.offsetMs) > MAX_TOLERATED_SKEW_MS) {
          log.warn('Desfase de reloj corregido', { offsetMs: orch.clockOffsetMs, rttMs: measured.rttMs });
          this.d.applyOffset?.(measured.offsetMs);
        }
      }
      const init = await orch.initialize();
      if (init === 'DONE') return 'DONE';
      if (init === 'SESSION_EXPIRED') await orch.initialize();
    }

    // T-30: navegador fresco con la página abierta y 2 personas seleccionadas.
    if (clock.now() < T - BROWSER_LEAD_MS) await waitUntil(clock, T - BROWSER_LEAD_MS, signal);
    if (clock.now() < T) {
      const prep = await orch.initialize();
      if (prep === 'DONE') return 'DONE';
      if (orch.sm.canGo('WAITING_FOR_RELEASE')) await orch.sm.go('WAITING_FOR_RELEASE', `Apertura ${opp.atLocal}`);
      await orch.publishStatus();
    }

    // T=0: consultar en el instante de apertura y después al ritmo permitido.
    await waitUntil(clock, T, signal);
    let last: CycleResult = 'CONTINUE';
    while (clock.now() < end && !signal?.aborted) {
      const started = clock.now();
      last = await orch.runCycle(orch.activeDates());
      if (last === 'DONE' || last === 'BLOCKED') return last;
      if (last === 'RATE_LIMITED' || last === 'SESSION_EXPIRED' || last === 'HUMAN_ACTION_REQUIRED') await this.afterCycle(last, signal);
      const elapsed = clock.now() - started;
      await clock.sleep(Math.max(poll.minIntervalMs - elapsed, poll.releasePollMs - elapsed, 0), signal);
    }

    const summary = Object.entries(orch.lastDates)
      .map(([date, s]) => `${date}: ${s.status}`)
      .join(' · ');
    await notifier.notify({
      type: 'WINDOW_ENDED_NO_AVAILABILITY',
      title: 'Ventana de apertura terminada sin reserva',
      body: `${opp.atLocal}. ${summary || 'Sin lecturas'}. Continúa el monitoreo de cancelaciones.`,
    });
    return last;
  }
}

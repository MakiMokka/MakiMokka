import { randomUUID } from 'node:crypto';
import type { RestaurantAdapter } from './adapters/types.js';
import { AvailabilityEngine } from './availability/engine.js';
import { BookingEngine } from './booking/engine.js';
import type { RuntimeConfig } from './core/config.js';
import { errorMessage, type Logger } from './core/logger.js';
import { slotKey } from './core/preferences.js';
import { StateMachine, type BotState } from './core/stateMachine.js';
import { localDateTime } from './core/time.js';
import type { IsoDate } from './core/types.js';
import type { Notifier } from './notify/notifier.js';
import type { Store, WorkerStatus } from './store/types.js';

export type CycleResult =
  | 'DONE'
  | 'CONTINUE'
  | 'BLOCKED'
  | 'HUMAN_ACTION_REQUIRED'
  | 'RATE_LIMITED'
  | 'SESSION_EXPIRED'
  | 'PAUSED'
  | 'ERROR';

export interface OrchestratorDeps {
  cfg: RuntimeConfig;
  adapter: RestaurantAdapter;
  store: Store;
  notifier: Notifier;
  log: Logger;
  now?: () => number;
}

/** Coordina disponibilidad + reservación en ciclos. El scheduler decide cuándo llamar a cada ciclo. */
export class Orchestrator {
  readonly sm: StateMachine;
  readonly holder = `worker-${randomUUID()}`;
  private readonly availability: AvailabilityEngine;
  private readonly booking: BookingEngine;
  private readonly now: () => number;
  private notified = new Set<string>();
  private offered = new Set<string>();
  private consecutiveErrors = 0;
  private initialized = false;
  nextReleaseAt: string | null = null;
  lastCheckAt: string | null = null;
  clockOffsetMs = 0;
  lastDates: WorkerStatus['dates'] = {};

  constructor(private readonly d: OrchestratorDeps) {
    const { cfg, store, log } = d;
    this.now = d.now ?? Date.now;
    this.sm = new StateMachine('IDLE', async (t) => {
      log.info('Transición', { from: t.from, to: t.to, reason: t.reason });
      await store.logTransition(cfg.campaign.campaignId, t).catch((err) => log.error('No se pudo registrar transición', { err: errorMessage(err) }));
      await this.publishStatus();
    });
    this.availability = new AvailabilityEngine(d.adapter, cfg.campaign.targets, cfg.campaign.partySize);
    this.booking = new BookingEngine({
      campaignId: cfg.campaign.campaignId,
      restaurantName: cfg.campaign.restaurant.name,
      restaurantUrl: cfg.campaign.restaurant.url,
      timezone: cfg.campaign.restaurant.timezone,
      adapter: d.adapter,
      store,
      notifier: d.notifier,
      sm: this.sm,
      log,
      guest: cfg.guest,
      holder: this.holder,
    });
  }

  get campaignId(): string {
    return this.d.cfg.campaign.campaignId;
  }

  /** Fechas objetivo cuyo último horario aceptable todavía no pasó. */
  activeDates(): IsoDate[] {
    const zone = this.d.cfg.campaign.restaurant.timezone;
    return this.d.cfg.campaign.targets
      .filter((t) => localDateTime(t.date, t.maxTime ?? '23:59', zone).toMillis() > this.now())
      .sort((a, b) => a.priority - b.priority)
      .map((t) => t.date);
  }

  /** ¿Ya hay reserva o un envío sin verificar? En ambos casos no se debe buscar ni reservar. */
  async guard(): Promise<CycleResult | null> {
    const { store } = this.d;
    if (await store.getConfirmed(this.campaignId)) {
      if (this.sm.state !== 'CONFIRMED') await this.forceState('CONFIRMED', 'Reserva confirmada existente en el store');
      return 'DONE';
    }
    const unresolved = await store.listUnresolvedAttempts(this.campaignId);
    if (unresolved.length > 0) {
      await this.forceState('HUMAN_ACTION_REQUIRED', `Intento ${unresolved[0]!.id} enviado sin verificar`);
      return 'BLOCKED';
    }
    const settings = await store.getRuntimeSettings(this.campaignId);
    if (settings?.paused) return 'PAUSED';
    return null;
  }

  /** Lleva la máquina a un estado alcanzable desde cualquier punto (pasando por IDLE si hace falta). */
  private async forceState(to: BotState, reason: string): Promise<void> {
    if (this.sm.state === to) return;
    if (!this.sm.canGo(to) && this.sm.canGo('IDLE')) await this.sm.go('IDLE', 'Reinicio de flujo');
    await this.sm.go(to, reason);
  }

  async initialize(): Promise<CycleResult> {
    const guard = await this.guard();
    if (guard) return guard;
    const { adapter, cfg, notifier } = this.d;
    try {
      await this.forceState('INITIALIZING', 'Preparando navegador');
      await adapter.init();
      const health = await adapter.healthCheck();
      if (health.humanActionRequired) {
        await this.sm.go('HUMAN_ACTION_REQUIRED', health.detail);
        await notifier.notify({ type: 'HUMAN_ACTION_REQUIRED', title: 'Acción humana requerida', body: health.detail, url: cfg.campaign.restaurant.url, urgent: true });
        return 'HUMAN_ACTION_REQUIRED';
      }
      if (health.sessionExpired) {
        await this.sm.go('SESSION_EXPIRED', health.detail);
        await notifier.notify({ type: 'SESSION_EXPIRED', title: 'Sesión expirada', body: health.detail, url: cfg.campaign.restaurant.url, urgent: true });
        return 'SESSION_EXPIRED';
      }
      if (health.rateLimited) {
        await this.sm.go('RATE_LIMITED', health.detail);
        return 'RATE_LIMITED';
      }
      if (!health.ok) throw new Error(health.detail);
      await adapter.prepare(cfg.campaign.partySize);
      await this.sm.go('READY', `Página lista para ${cfg.campaign.partySize} personas`);
      if (!this.initialized) {
        this.initialized = true;
        await notifier.notify({
          type: 'MONITORING_STARTED',
          title: 'Monitoreo iniciado',
          body: `${cfg.campaign.restaurant.name}: ${this.activeDates().join(', ')} · modo ${cfg.mode}${cfg.adapterVerified ? '' : ' (adapter sin verificar: no se enviará el formulario)'}`,
        });
      }
      return 'CONTINUE';
    } catch (err) {
      await this.forceState('FAILED', errorMessage(err));
      return 'ERROR';
    }
  }

  /** Un ciclo: consultar fechas activas, elegir la mejor opción y, si procede, reservar. */
  async runCycle(only?: IsoDate[]): Promise<CycleResult> {
    const guard = await this.guard();
    if (guard) return guard;
    const { cfg, store, notifier, log } = this.d;
    const dates = this.activeDates().filter((dt) => !only || only.includes(dt));
    if (dates.length === 0) return 'DONE';

    if (!this.sm.canGo('CHECKING_AVAILABILITY')) {
      const r = await this.initialize();
      if (r !== 'CONTINUE') return r;
    }
    await this.sm.go('CHECKING_AVAILABILITY', dates.join(','));
    const result = await this.availability.check(dates);
    this.lastCheckAt = new Date(this.now()).toISOString();
    this.lastDates = Object.fromEntries(
      result.availability.map((a) => [a.date, { status: a.status, slots: a.slots.filter((s) => s.status === 'AVAILABLE').map((s) => s.time), checkedAt: a.checkedAt }]),
    );
    await store.saveAvailability(this.campaignId, result.availability).catch((err) => log.error('No se pudo guardar disponibilidad', { err: errorMessage(err) }));
    for (const ch of result.changes.filter((c) => c.from !== null)) {
      await store.logEvent({ campaignId: this.campaignId, type: 'AVAILABILITY_CHANGED', message: `${ch.key}: ${ch.from} → ${ch.to}` }).catch(() => undefined);
    }

    if (result.candidates.length === 0) {
      const allBroken = result.availability.length > 0 && result.availability.every((a) => a.status === 'ERROR' || a.status === 'UNKNOWN');
      if (allBroken) {
        this.consecutiveErrors++;
        const detail = result.availability.map((a) => `${a.date}: ${a.status} ${a.detail ?? ''}`).join('; ');
        await this.sm.go('FAILED', `No se pudo leer la disponibilidad: ${detail}`);
        if (this.consecutiveErrors === cfg.campaign.polling.maxConsecutiveErrors) {
          await notifier.notify({ type: 'CRITICAL_ERROR', title: 'Error crítico', body: `${this.consecutiveErrors} consultas seguidas fallaron. ${detail}`, urgent: true });
        }
        return 'ERROR';
      }
      this.consecutiveErrors = 0;
      const notReleased = result.availability.every((a) => a.status === 'NOT_YET_RELEASED');
      await this.sm.go(notReleased ? 'NOT_YET_RELEASED' : 'NO_AVAILABILITY', result.availability.map((a) => `${a.date}=${a.status}`).join(' '));
      return 'CONTINUE';
    }

    this.consecutiveErrors = 0;
    const best = result.candidates[0]!;
    await this.sm.go('SLOT_FOUND', `${best.slot.date} ${best.slot.time}`);
    const fresh = result.candidates.filter((c) => !this.notified.has(slotKey(c.slot)));
    if (fresh.length > 0) {
      fresh.forEach((c) => this.notified.add(slotKey(c.slot)));
      await notifier.notify({
        type: 'AVAILABILITY_FOUND',
        title: 'Disponibilidad encontrada',
        body: fresh.map((c) => `${c.target.label} ${c.slot.time}`).join(' · '),
        url: this.d.adapter.deepLink?.(fresh[0]!.slot, cfg.guest) ?? cfg.campaign.restaurant.url,
        urgent: true,
        data: { slots: fresh.map((c) => slotKey(c.slot)) },
      });
    }

    const settings = await store.getRuntimeSettings(this.campaignId);
    const mode = settings?.mode ?? cfg.mode;
    let candidates = result.candidates;
    if (mode !== 'AUTO' || !cfg.adapterVerified) {
      // Sin envío automático solo se prepara cada horario una vez; la persona reserva desde el aviso.
      candidates = candidates.filter((c) => !this.offered.has(slotKey(c.slot)));
      candidates.forEach((c) => this.offered.add(slotKey(c.slot)));
      if (candidates.length === 0) {
        await this.sm.go('READY', 'Horarios ya notificados para reserva manual');
        return 'CONTINUE';
      }
    }
    const res = await this.booking.book(candidates, mode, cfg.adapterVerified);
    log.info('Resultado de reservación', { kind: res.kind });
    switch (res.kind) {
      case 'CONFIRMED':
      case 'ALREADY_CONFIRMED':
        await this.forceState('CONFIRMED', 'Reserva confirmada');
        return 'DONE';
      case 'ALL_GONE':
        await this.sm.go('NO_AVAILABILITY', 'Las mesas desaparecieron antes de confirmar');
        return 'CONTINUE';
      case 'LOCKED':
        await this.sm.go('READY', 'Otro proceso tiene el lock de reservación');
        return 'CONTINUE';
      case 'BLOCKED':
        await this.forceState('HUMAN_ACTION_REQUIRED', res.reason);
        return 'BLOCKED';
      case 'HUMAN_ACTION_REQUIRED':
        return 'HUMAN_ACTION_REQUIRED';
      case 'SESSION_EXPIRED':
        await this.d.notifier.notify({ type: 'SESSION_EXPIRED', title: 'Sesión expirada', body: 'La sesión expiró durante la reservación; se reinicia.', urgent: true });
        return 'SESSION_EXPIRED';
      case 'RATE_LIMITED':
        return 'RATE_LIMITED';
      case 'FAILED':
        await this.d.notifier.notify({ type: 'CRITICAL_ERROR', title: 'Error al reservar', body: res.error, urgent: true });
        return 'ERROR';
    }
  }

  async publishStatus(): Promise<void> {
    await this.d.store
      .setWorkerStatus({
        campaignId: this.campaignId,
        state: this.sm.state,
        nextReleaseAt: this.nextReleaseAt,
        lastCheckAt: this.lastCheckAt,
        heartbeatAt: new Date(this.now()).toISOString(),
        dates: this.lastDates,
        clockOffsetMs: this.clockOffsetMs,
      })
      .catch((err) => this.d.log.error('No se pudo publicar estado', { err: errorMessage(err) }));
  }
}

import { describe, expect, it } from 'vitest';
import { SimulatedAdapter } from '../src/adapters/simulated.js';
import { silentLogger } from '../src/core/logger.js';
import { Scheduler } from '../src/scheduler/scheduler.js';
import { releaseCalendar } from '../src/scheduler/releaseCalendar.js';
import { MemoryStore } from '../src/store/memory.js';
import { at, harness } from './harness.js';

async function initAndCycle(h: ReturnType<typeof harness>) {
  expect(await h.orch.initialize()).toBe('CONTINUE');
  return h.orch.runCycle();
}

describe('Escenarios de reservación', () => {
  it('1. aparece mesa martes 3 a las 20:30 → confirma esa', async () => {
    const h = harness();
    h.adapter.setDay('2026-11-03', { available: ['20:30'] });
    expect(await initAndCycle(h)).toBe('DONE');
    const r = await h.store.getConfirmed(h.campaign.campaignId);
    expect(r).toMatchObject({ date: '2026-11-03', time: '20:30', partySize: 2, status: 'CONFIRMED' });
    expect(r!.confirmationId).toMatch(/^SIM-/);
    expect(h.orch.sm.state).toBe('CONFIRMED');
    const success = h.channel.sent.find((n) => n.type === 'RESERVATION_CONFIRMED')!;
    expect(success.title).toBe('MANTEQUILLA SOCIAL CLUB');
    expect(success.body).toContain('Reserva confirmada');
    expect(success.body).toContain('Personas: 2');
    expect(success.body).toContain(`Confirmación: ${r!.confirmationId}`);
  });

  it('2. aparece mesa viernes 6 a las 19:00 → confirma esa', async () => {
    const h = harness({ now: at('2026-11-05T00:00:00') });
    h.adapter.setDay('2026-11-03', { soldOut: ['20:30', '22:00'] }).setDay('2026-11-06', { available: ['19:00'] });
    expect(await initAndCycle(h)).toBe('DONE');
    expect(await h.store.getConfirmed(h.campaign.campaignId)).toMatchObject({ date: '2026-11-06', time: '19:00' });
  });

  it('3. solo hay disponibilidad el sábado 7', async () => {
    const h = harness();
    h.adapter
      .setDay('2026-11-03', { soldOut: ['20:30', '22:00'] })
      .setDay('2026-11-06', { soldOut: ['19:00', '20:30', '22:00'] })
      .setDay('2026-11-07', { available: ['16:00'], soldOut: ['13:00'] });
    expect(await initAndCycle(h)).toBe('DONE');
    expect(await h.store.getConfirmed(h.campaign.campaignId)).toMatchObject({ date: '2026-11-07', time: '16:00' });
  });

  it('4. solo hay disponibilidad el domingo 8', async () => {
    const h = harness();
    h.adapter.setDay('2026-11-07', { soldOut: ['13:00', '22:00'] }).setDay('2026-11-08', { available: ['13:00'] });
    expect(await initAndCycle(h)).toBe('DONE');
    expect(await h.store.getConfirmed(h.campaign.campaignId)).toMatchObject({ date: '2026-11-08', time: '13:00' });
  });

  it('5. varias mesas a la vez → prioridad de fecha y horario preferido, una sola reserva', async () => {
    const h = harness();
    h.adapter
      .setDay('2026-11-03', { available: ['22:00', '20:30', '19:30'] })
      .setDay('2026-11-06', { available: ['19:00'] })
      .setDay('2026-11-07', { available: ['13:00'] });
    expect(await initAndCycle(h)).toBe('DONE');
    expect(await h.store.getConfirmed(h.campaign.campaignId)).toMatchObject({ date: '2026-11-03', time: '20:30' });
    expect(h.adapter.platformBookings).toHaveLength(1);
  });

  it('6. la mesa desaparece antes de confirmar → pasa a la siguiente opción', async () => {
    const h = harness();
    h.adapter.setDay('2026-11-03', { available: ['20:30'] }).setDay('2026-11-06', { available: ['19:00'] });
    h.adapter.behavior.set('2026-11-03 20:30', 'gone');
    expect(await initAndCycle(h)).toBe('DONE');
    expect(await h.store.getConfirmed(h.campaign.campaignId)).toMatchObject({ date: '2026-11-06', time: '19:00' });
    const attempts = await h.store.listAttempts(h.campaign.campaignId);
    expect(attempts.map((a) => a.status)).toEqual(['SLOT_GONE', 'CONFIRMED']);
  });

  it('6b. la única mesa desaparece → sigue buscando sin reservar', async () => {
    const h = harness();
    h.adapter.setDay('2026-11-03', { available: ['22:00'] });
    h.adapter.behavior.set('2026-11-03 22:00', 'gone');
    expect(await initAndCycle(h)).toBe('CONTINUE');
    expect(h.orch.sm.state).toBe('NO_AVAILABILITY');
    expect(await h.store.getConfirmed(h.campaign.campaignId)).toBeNull();
  });

  it('7. CoverManager pide intervención humana (CAPTCHA) → se detiene y notifica', async () => {
    const h = harness();
    h.adapter.setDay('2026-11-03', { available: ['20:30'] });
    h.adapter.behavior.set('2026-11-03 20:30', 'captcha');
    expect(await initAndCycle(h)).toBe('HUMAN_ACTION_REQUIRED');
    expect(h.orch.sm.state).toBe('HUMAN_ACTION_REQUIRED');
    expect(h.adapter.calls.submit).toBe(0);
    const n = h.channel.sent.find((x) => x.type === 'HUMAN_ACTION_REQUIRED')!;
    expect(n.url).toBe(h.campaign.restaurant.url);
  });

  it('7b. CAPTCHA en la carga inicial → HUMAN_ACTION_REQUIRED sin consultar', async () => {
    const h = harness();
    h.adapter.health = { ok: false, detail: 'CAPTCHA', humanActionRequired: true };
    expect(await h.orch.initialize()).toBe('HUMAN_ACTION_REQUIRED');
    expect(h.adapter.calls.check).toBe(0);
  });

  it('8. la sesión expira antes de la apertura → notifica, reinicia y reserva al abrir', async () => {
    const opp = releaseCalendar(harness().campaign)[0]!; // lun 2 nov 12:00 → mar 3
    const h = harness({ now: opp.at - 200_000 });
    let healthCalls = 0;
    h.adapter.healthCheck = async () =>
      ++healthCalls === 1 ? { ok: false, detail: 'Sesión expirada', sessionExpired: true } : { ok: true, detail: 'ok' };
    const checkDates = h.adapter.checkDates.bind(h.adapter);
    // Antes de la apertura no hay nada; en T=0 aparece la mesa.
    h.adapter.checkDates = async (dates, p) => {
      if (h.clock.now() >= opp.at) h.adapter.setDay('2026-11-03', { available: ['22:00'] });
      return checkDates(dates, p);
    };
    const sched = new Scheduler({ campaign: h.campaign, orch: h.orch, clock: h.clock, notifier: h.notifier, log: silentLogger, measureOffset: async () => ({ offsetMs: 0, rttMs: 10 }) });
    expect(await sched.releaseWindow(opp)).toBe('DONE');
    expect(h.channel.types()).toContain('SESSION_EXPIRED');
    expect(await h.store.getConfirmed(h.campaign.campaignId)).toMatchObject({ date: '2026-11-03', time: '22:00' });
    expect(h.adapter.calls.check).toBeGreaterThan(0);
  });

  it('9. confirmación obtenida pero el navegador pierde conexión → UNCERTAIN, bloqueo, sin duplicado', async () => {
    const h = harness();
    h.adapter.setDay('2026-11-03', { available: ['20:30', '22:00'] });
    h.adapter.behavior.set('2026-11-03 20:30', 'disconnect_after_submit');
    expect(await initAndCycle(h)).toBe('BLOCKED');
    expect(await h.store.getConfirmed(h.campaign.campaignId)).toBeNull();
    const [attempt] = await h.store.listUnresolvedAttempts(h.campaign.campaignId);
    expect(attempt).toMatchObject({ status: 'UNCERTAIN', date: '2026-11-03', time: '20:30' });
    expect(h.channel.sent.some((n) => n.title === 'Verificar reserva enviada')).toBe(true);

    // Aunque sigue habiendo mesa a las 22:00, no se intenta de nuevo.
    expect(await h.orch.runCycle()).toBe('BLOCKED');
    expect(h.adapter.platformBookings).toHaveLength(1);
    expect(h.adapter.calls.submit).toBe(1);

    // Un reinicio del worker con el mismo store también queda bloqueado.
    const h2 = harness({ store: h.store, adapter: h.adapter });
    expect(await h2.orch.runCycle()).toBe('BLOCKED');
    expect(h.adapter.calls.submit).toBe(1);
  });

  it('10. ya existe reserva confirmada y el scheduler vuelve a ejecutarse → no hace nada', async () => {
    const store = new MemoryStore();
    const first = harness({ store });
    first.adapter.setDay('2026-11-03', { available: ['20:30'] });
    expect(await initAndCycle(first)).toBe('DONE');

    const adapter = new SimulatedAdapter().setDay('2026-11-06', { available: ['19:00'] });
    const h = harness({ store, adapter });
    const sched = new Scheduler({ campaign: h.campaign, orch: h.orch, clock: h.clock, notifier: h.notifier, log: silentLogger });
    expect(await sched.run()).toBe('CONFIRMED');
    expect(adapter.calls).toEqual({ init: 0, prepare: 0, check: 0, book: 0, submit: 0 });
    expect(h.orch.sm.state).toBe('CONFIRMED');
    expect(first.adapter.platformBookings.length + adapter.platformBookings.length).toBe(1);
  });
});

describe('Reglas y seguridad', () => {
  it('no acepta horarios antes del mínimo (martes < 20:00, viernes < 19:00)', async () => {
    const h = harness();
    h.adapter.setDay('2026-11-03', { available: ['19:30', '18:00'] }).setDay('2026-11-06', { available: ['17:30', '18:59'] });
    expect(await initAndCycle(h)).toBe('CONTINUE');
    expect(h.adapter.calls.book).toBe(0);
    expect(h.orch.sm.state).toBe('NO_AVAILABILITY');
  });

  it('un fallo de carga no se confunde con ausencia de disponibilidad', async () => {
    const h = harness();
    h.adapter.checkError = new Error('net::ERR_CONNECTION_RESET');
    expect(await initAndCycle(h)).toBe('ERROR');
    expect(h.orch.sm.state).toBe('FAILED');
    expect(Object.values(h.orch.lastDates).every((d) => d.status === 'ERROR')).toBe(true);
  });

  it('se recupera del error en el siguiente ciclo', async () => {
    const h = harness();
    h.adapter.checkError = new Error('timeout');
    await initAndCycle(h);
    h.adapter.checkError = null;
    h.adapter.setDay('2026-11-07', { available: ['20:30'] });
    expect(await h.orch.runCycle()).toBe('DONE');
  });

  it('depósito o cargo → pide confirmación humana, no envía', async () => {
    const h = harness();
    h.adapter.setDay('2026-11-03', { available: ['20:30'] });
    h.adapter.behavior.set('2026-11-03 20:30', 'payment');
    expect(await initAndCycle(h)).toBe('HUMAN_ACTION_REQUIRED');
    expect(h.adapter.calls.submit).toBe(0);
    expect(h.channel.sent.find((n) => n.type === 'HUMAN_ACTION_REQUIRED')!.body).toMatch(/depósito|cargo/i);
  });

  it('modo asistido: notifica con link, no envía y no repite el aviso', async () => {
    const h = harness({ mode: 'ASSISTED' });
    h.adapter.setDay('2026-11-03', { available: ['20:30'] });
    expect(await initAndCycle(h)).toBe('HUMAN_ACTION_REQUIRED');
    expect(await h.orch.runCycle()).toBe('CONTINUE');
    expect(h.adapter.calls.submit).toBe(0);
    expect(h.channel.types().filter((t) => t === 'AVAILABILITY_FOUND')).toHaveLength(1);
    expect(h.channel.types().filter((t) => t === 'HUMAN_ACTION_REQUIRED')).toHaveLength(1);
  });

  it('adapter sin verificar: aunque el modo sea AUTO nunca envía', async () => {
    const h = harness({ mode: 'AUTO', verified: false });
    h.adapter.setDay('2026-11-03', { available: ['20:30'] });
    await initAndCycle(h);
    expect(h.adapter.calls.submit).toBe(0);
    expect(await h.store.getConfirmed(h.campaign.campaignId)).toBeNull();
  });

  it('dos workers en paralelo sobre el mismo store → una sola reserva', async () => {
    const store = new MemoryStore();
    const adapter = new SimulatedAdapter().setDay('2026-11-03', { available: ['20:30', '22:00'] });
    const a = harness({ store, adapter });
    const b = harness({ store, adapter });
    await Promise.all([a.orch.initialize(), b.orch.initialize()]);
    const results = await Promise.all([a.orch.runCycle(), b.orch.runCycle()]);
    expect(results).toContain('DONE');
    expect(adapter.platformBookings).toHaveLength(1);
  });

  it('fechas pasadas dejan de consultarse', () => {
    const h = harness({ now: at('2026-11-07T00:30:00') });
    expect(h.orch.activeDates()).toEqual(['2026-11-07', '2026-11-08']);
  });
});

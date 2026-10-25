import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CoverManagerAdapter } from '../src/adapters/covermanager/adapter.js';
import { silentLogger } from '../src/core/logger.js';
import type { Guest } from '../src/core/types.js';

// Valida el código Playwright del adapter contra una página SINTÉTICA local.
// No prueba que los supuestos coincidan con CoverManager real: eso lo hace `npm run recon`.
const base = pathToFileURL(resolve('test/fixtures/synthetic-widget.html')).href;
const guest: Guest = { fullName: 'Persona Prueba', phone: '+52 55 1111 2222', email: 'prueba@example.com', partySize: 2, celebration: 'No' };
let adapter: CoverManagerAdapter | null = null;

function make(hash: Record<string, unknown>) {
  const h = Object.entries(hash).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'string' ? v : JSON.stringify(v))}`).join('&');
  adapter = new CoverManagerAdapter({ url: `${base}#${h}`, timezone: 'America/Mexico_City', headless: true, screenshotDir: 'state-test/screens', log: silentLogger, navigationTimeoutMs: 3000 });
  return adapter;
}

afterEach(async () => {
  await adapter?.close();
  adapter = null;
});

describe('CoverManagerAdapter (página sintética)', () => {
  it('lee disponibilidad: disponible, agotado y no publicado', async () => {
    const a = make({ open: { '2026-11-03': ['20:30'] }, sold: { '2026-11-06': ['19:00'] }, maxMonth: 10 });
    expect((await a.healthCheck()).ok).toBe(true);
    const res = await a.checkDates(['2026-11-03', '2026-11-06', '2026-11-07', '2026-12-01'], 2);
    const by = Object.fromEntries(res.map((r) => [r.date, r]));
    expect(by['2026-11-03']!.status).toBe('AVAILABLE');
    expect(by['2026-11-03']!.slots.map((s) => s.time)).toEqual(['20:30']);
    expect(by['2026-11-06']!.status).toBe('SOLD_OUT');
    expect(by['2026-11-07']!.status).toBe('SOLD_OUT'); // día deshabilitado
    expect(by['2026-12-01']!.status).toBe('NOT_YET_RELEASED');
  }, 60_000);

  it('llena el formulario sin enviar cuando submit=false', async () => {
    const a = make({ open: { '2026-11-03': ['20:30'] } });
    const out = await a.book({ date: '2026-11-03', time: '20:30', partySize: 2, status: 'AVAILABLE' }, guest, { submit: false, beforeSubmit: async () => { throw new Error('no'); } });
    expect(out.kind).toBe('READY_NOT_SUBMITTED');
  }, 60_000);

  it('envía, responde "No" a celebración, no marca publicidad y extrae el localizador', async () => {
    const a = make({ open: { '2026-11-03': ['20:30'] } });
    let marked = false;
    const out = await a.book({ date: '2026-11-03', time: '20:30', partySize: 2, status: 'AVAILABLE' }, guest, { submit: true, beforeSubmit: async () => { marked = true; } });
    expect(marked).toBe(true);
    expect(out).toMatchObject({ kind: 'CONFIRMED', confirmationId: 'CMX7781' });
    const form = await (a as unknown as { page: import('playwright').Page }).page.evaluate(() => (window as unknown as { __form: Record<string, string> }).__form);
    expect(form).toMatchObject({ name: 'Persona Prueba', phone: '+52 55 1111 2222', email: 'prueba@example.com', celebration: 'No', terms: 'on' });
    expect(form.ads).toBeUndefined();
  }, 60_000);

  it('detecta depósito/tarjeta y no envía', async () => {
    const a = make({ open: { '2026-11-03': ['20:30'] }, payment: '1' });
    const out = await a.book({ date: '2026-11-03', time: '20:30', partySize: 2, status: 'AVAILABLE' }, guest, { submit: true, beforeSubmit: async () => { throw new Error('no debe enviarse'); } });
    expect(out.kind).toBe('PAYMENT_REQUIRED');
  }, 60_000);

  it('horario que ya no existe → SLOT_GONE', async () => {
    const a = make({ open: { '2026-11-03': ['22:00'] } });
    const out = await a.book({ date: '2026-11-03', time: '20:30', partySize: 2, status: 'AVAILABLE' }, guest, { submit: true, beforeSubmit: async () => {} });
    expect(out.kind).toBe('SLOT_GONE');
  }, 60_000);
});

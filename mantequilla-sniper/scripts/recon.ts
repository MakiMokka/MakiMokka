// Fase 1 — Inspección técnica de la página real de CoverManager. NUNCA envía una reservación.
//
//   npm run recon                              → reporte de estructura, red y políticas
//   npm run recon -- --dry-run-form 2026-11-20 → además recorre el flujo hasta el formulario
//                                                con datos de prueba y se detiene antes de enviar
//
// Salida en recon-output/ (ignorado por git): report.md, aria-*.yml, network.json, *.png, recon.har
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Frame } from 'playwright';
import { CoverManagerAdapter } from '../src/adapters/covermanager/adapter.js';
import { CM } from '../src/adapters/covermanager/selectors.js';
import { loadCampaign } from '../src/core/config.js';
import { createLogger } from '../src/core/logger.js';

const OUT = 'recon-output';
mkdirSync(OUT, { recursive: true });
const c = loadCampaign(process.env.CAMPAIGN_CONFIG ?? 'config/mantequilla.json');
const args = process.argv.slice(2);
const dryRunDate = args.includes('--dry-run-form') ? args[args.indexOf('--dry-run-form') + 1] : undefined;
const report: string[] = [`# Recon CoverManager — ${c.restaurant.name}`, '', `Fecha: ${new Date().toISOString()}`, `URL: ${c.restaurant.url}`, ''];

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
const context = await browser.newContext({ locale: 'es-MX', timezoneId: c.restaurant.timezone, recordHar: { path: join(OUT, 'recon.har'), content: 'omit' } });
const page = await context.newPage();
const network: Array<{ method: string; url: string; status: number; type: string; jsonKeys?: string[] }> = [];
page.on('response', async (r) => {
  const type = r.request().resourceType();
  if (!['xhr', 'fetch', 'document'].includes(type)) return;
  const entry: (typeof network)[number] = { method: r.request().method(), url: r.url().split('?')[0]!, status: r.status(), type };
  if ((r.headers()['content-type'] ?? '').includes('json')) {
    const body = await r.json().catch(() => null);
    if (body && typeof body === 'object') entry.jsonKeys = Object.keys(body as object).slice(0, 30);
  }
  network.push(entry);
});

const res = await page.goto(c.restaurant.url, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
report.push(`## Carga`, `- HTTP: ${res?.status()}`, `- Título: ${await page.title()}`, `- Cabecera Date del servidor: ${res?.headers()['date'] ?? 'n/d'}`, '');
await page.screenshot({ path: join(OUT, '01-landing.png'), fullPage: true });

report.push('## Frames');
const frames: Frame[] = page.frames();
for (const [i, f] of frames.entries()) {
  report.push(`- [${i}] ${f.url()}`);
  const aria = await f.locator('body').ariaSnapshot().catch((e) => `error: ${e}`);
  writeFileSync(join(OUT, `aria-${i}.yml`), aria);
}
report.push('');

const captcha = frames.some((f) => CM.captchaFrameUrl.test(f.url()));
const allText = (await Promise.all(frames.map((f) => f.locator('body').innerText().catch(() => '')))).join('\n');
report.push('## Restricciones detectadas', `- CAPTCHA/anti-bot: ${captcha || CM.captchaText.test(allText) ? 'SÍ' : 'no visible en la carga'}`, `- Login visible: ${CM.loginText.test(allText) ? 'sí (revisar)' : 'no'}`, '');

report.push('## Texto de políticas (líneas relevantes)');
const policy = /cancel|dep[oó]sito|tarjeta|garant|cargo|pago|no.?show|lista de espera|antelaci|anticipaci|d[ií]as|liber|turno|m[aá]ximo|personas|condiciones/i;
for (const line of [...new Set(allText.split('\n').map((l) => l.trim()).filter((l) => l && policy.test(l)))].slice(0, 80)) report.push(`> ${line}`);
report.push('');

report.push('## Controles de formulario visibles (sin valores)');
for (const f of frames) {
  const controls = await f
    .locator('input, select, textarea, button')
    .evaluateAll((els) =>
      els.slice(0, 120).map((e) => {
        const el = e as HTMLInputElement;
        return `${el.tagName.toLowerCase()}[type=${el.type ?? ''}] name=${el.name ?? ''} label="${(el.labels?.[0]?.innerText ?? el.getAttribute('aria-label') ?? el.placeholder ?? el.innerText ?? '').trim().slice(0, 60)}"${el.required ? ' required' : ''}${el.disabled ? ' disabled' : ''}`;
      }),
    )
    .catch(() => []);
  for (const ctl of controls) report.push(`- ${ctl}`);
}
report.push('');

report.push('## Horizonte de reserva (último día seleccionable)');
const adapter = new CoverManagerAdapter({ url: c.restaurant.url, timezone: c.restaurant.timezone, headless: true, screenshotDir: OUT, log: createLogger({ recon: true }) });
const dates = [...c.targets.map((t) => t.date)];
const probe = await adapter.checkDates(dates, c.partySize).catch((e) => [{ date: '*', status: 'ERROR', detail: String(e), slots: [] }]);
for (const d of probe) report.push(`- ${d.date}: ${d.status}${'slots' in d && d.slots.length ? ` [${d.slots.map((s) => `${s.time}:${s.status}`).join(', ')}]` : ''}${d.detail ? ` — ${d.detail}` : ''}`);
report.push('', 'Compara con la fecha de hoy para deducir cuántos días de anticipación se abren (ajusta `release.daysAheadCandidates`).', '');

if (dryRunDate) {
  report.push(`## Dry run del formulario (${dryRunDate}) — sin envío`);
  const avail = await adapter.checkDates([dryRunDate], c.partySize);
  const slot = avail[0]?.slots.find((s) => s.status === 'AVAILABLE');
  if (!slot) report.push(`- No hay horario disponible en ${dryRunDate}: ${avail[0]?.status} ${avail[0]?.detail ?? ''}`);
  else {
    const outcome = await adapter.book(
      slot,
      { fullName: 'Prueba Recon', phone: '+52 55 0000 0000', email: 'recon@example.com', partySize: c.partySize, celebration: 'No' },
      { submit: false, beforeSubmit: async () => { throw new Error('recon nunca envía'); } },
    );
    report.push(`- Resultado: ${JSON.stringify(outcome)}`, '- Si es READY_NOT_SUBMITTED el flujo completo funciona y puede activarse COVERMANAGER_ADAPTER_VERIFIED=true.');
  }
  report.push('');
}
await adapter.close();

writeFileSync(join(OUT, 'network.json'), JSON.stringify(network, null, 2));
report.push('## Red', `${network.length} respuestas XHR/fetch/document registradas en network.json (sin cuerpos).`, '');
writeFileSync(join(OUT, 'report.md'), report.join('\n'));
await context.close();
await browser.close();
console.log(`Reporte en ${OUT}/report.md`);

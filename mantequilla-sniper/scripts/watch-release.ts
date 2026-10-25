// Observa a qué hora se libera un día nuevo. Abre el widget público (como lo haría una persona) y
// registra el estado de cada día que la propia página recibe del calendario. No reserva nada.
//   npx tsx scripts/watch-release.ts <desde HH:mm> <hasta HH:mm> [cadaSegundos]
import { appendFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { DateTime } from 'luxon';

const ZONE = 'America/Mexico_City';
const WIDGET = 'https://www.covermanager.com/reservation/module_restaurant/mantequilla-social-club/spanish';
const [from = '23:57', to = '00:06', every = '20'] = process.argv.slice(2);
const OUT = 'recon-output/release-watch.log';
mkdirSync('recon-output', { recursive: true });

function nextAt(hhmm: string, after: DateTime): DateTime {
  const [h, m] = hhmm.split(':').map(Number);
  let t = after.set({ hour: h, minute: m, second: 0, millisecond: 0 });
  if (t < after.minus({ minutes: 1 })) t = t.plus({ days: 1 });
  return t;
}

const now = DateTime.now().setZone(ZONE);
const start = nextAt(from, now);
let end = nextAt(to, start);
if (end <= start) end = end.plus({ days: 1 });
const log = (s: string) => {
  const line = `${DateTime.now().setZone(ZONE).toFormat('yyyy-MM-dd HH:mm:ss.SSS')} ${s}`;
  console.log(line);
  appendFileSync(OUT, line + '\n');
};
log(`Observación ${start.toFormat('dd HH:mm')} → ${end.toFormat('dd HH:mm')} cada ${every}s`);
await new Promise((r) => setTimeout(r, Math.max(0, start.toMillis() - Date.now())));

const browser = await chromium.launch();
let last = '';
while (Date.now() < end.toMillis()) {
  const page = await browser.newPage({ locale: 'es-MX', timezoneId: ZONE });
  const days: Record<string, string> = {};
  page.on('response', async (r) => {
    if (!r.url().includes('/reservation/highlight')) return;
    const body = (await r.json().catch(() => null)) as Record<string, [boolean, string]> | null;
    if (body) for (const [d, v] of Object.entries(body)) days[d] = v[1] || 'libre';
  });
  try {
    await page.goto(WIDGET, { waitUntil: 'networkidle', timeout: 30_000 });
    const today = DateTime.now().setZone(ZONE).toISODate()!;
    const future = Object.entries(days).filter(([d]) => d >= today).sort();
    const lastOpen = future.filter(([, s]) => s !== 'close_date').pop()?.[0] ?? '?';
    const summary = `ultimo_abierto=${lastOpen} | ` + future.filter(([d]) => d >= DateTime.fromISO(lastOpen).minus({ days: 2 }).toISODate()!).slice(0, 6).map(([d, s]) => `${d.slice(5)}:${s}`).join(' ');
    if (summary !== last) log(summary);
    last = summary;
  } catch (e) {
    log(`error ${(e as Error).message.split('\n')[0]}`);
  } finally {
    await page.close();
  }
  await new Promise((r) => setTimeout(r, Number(every) * 1000));
}
log('Fin de la observación');
await browser.close();

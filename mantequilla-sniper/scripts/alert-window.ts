// Vigila una ventana de apertura y emite UNA línea por cada horario válido nuevo (para Monitor/push).
//   npx tsx scripts/alert-window.ts <HH:mm apertura> <minutos de ventana> [intervaloSeg]
// Salida (stdout, una línea por evento):
//   MESA <fecha> <hora> <link prellenado>
//   ESTADO <resumen>      (cada cambio de estado de las fechas)
//   ERROR <detalle>       (3 lecturas fallidas seguidas)
//   FIN <resumen>
import { DateTime } from 'luxon';
import { CoverManagerAdapter } from '../src/adapters/covermanager/adapter.js';
import { prefilledLink } from '../src/adapters/covermanager/link.js';
import { loadCampaign, loadGuest } from '../src/core/config.js';
import { silentLogger } from '../src/core/logger.js';
import { rankCandidates, slotKey } from '../src/core/preferences.js';
import { localDateTime } from '../src/core/time.js';

const c = loadCampaign(process.env.CAMPAIGN_CONFIG ?? 'config/mantequilla.json');
const guest = loadGuest(process.env, c.partySize);
const zone = c.restaurant.timezone;
const [openAt = '12:00', minutes = '10', every = '3'] = process.argv.slice(2);
const intervalMs = Math.max(Number(every) * 1000, c.polling.minIntervalMs);

const now = DateTime.now().setZone(zone);
let T = DateTime.fromISO(`${now.toISODate()}T${openAt}`, { zone });
if (T.plus({ minutes: Number(minutes) }) < now) T = T.plus({ days: 1 });
const end = T.plus({ minutes: Number(minutes) }).toMillis();
const say = (s: string) => process.stdout.write(`${s}\n`);

const active = c.targets.filter((t) => localDateTime(t.date, t.maxTime ?? '23:59', zone).toMillis() > Date.now()).map((t) => t.date);
const adapter = new CoverManagerAdapter({ url: c.restaurant.url, slug: c.restaurant.slug, timezone: zone, headless: true, screenshotDir: 'state/screens', log: silentLogger });

// Navegador listo 30 s antes; primera lectura justo en la apertura.
await new Promise((r) => setTimeout(r, Math.max(0, T.toMillis() - 30_000 - Date.now())));
await adapter.init();
await new Promise((r) => setTimeout(r, Math.max(0, T.toMillis() - Date.now())));

const seen = new Set<string>();
let lastSummary = '';
let errors = 0;
while (Date.now() < end) {
  const started = Date.now();
  const days = await adapter.checkDates(active, c.partySize);
  const summary = days.map((d) => `${d.date.slice(5)}:${d.status}`).join(' ');
  if (summary !== lastSummary) say(`ESTADO ${DateTime.now().setZone(zone).toFormat('HH:mm:ss')} ${summary}`);
  lastSummary = summary;
  errors = days.every((d) => d.status === 'ERROR' || d.status === 'UNKNOWN') ? errors + 1 : 0;
  if (errors === 3) say(`ERROR ${days.map((d) => d.detail).join('; ')}`);
  for (const cand of rankCandidates(c.targets, days, c.partySize)) {
    const k = slotKey(cand.slot);
    if (seen.has(k)) continue;
    seen.add(k);
    say(`MESA ${cand.slot.date} ${cand.slot.time} ${prefilledLink(c.restaurant.slug, cand.slot, guest)}`);
  }
  await new Promise((r) => setTimeout(r, Math.max(0, intervalMs - (Date.now() - started))));
}
say(`FIN ${lastSummary}`);
await adapter.close();

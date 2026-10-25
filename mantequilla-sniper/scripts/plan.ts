// Imprime el calendario de oportunidades de reserva según la configuración.
import { DateTime } from 'luxon';
import { loadCampaign } from '../src/core/config.js';
import { releaseCalendar } from '../src/scheduler/releaseCalendar.js';

const c = loadCampaign(process.env.CAMPAIGN_CONFIG ?? 'config/mantequilla.json');
const zone = c.restaurant.timezone;
const now = Date.now();
console.log(`${c.restaurant.name} — liberación ${c.release.times.join(' o ')} ${zone}, reglas candidatas: ${c.release.daysAheadCandidates.join(', ')} día(s) de anticipación\n`);
for (const o of releaseCalendar(c)) {
  const when = DateTime.fromMillis(o.at, { zone }).setLocale('es-MX').toFormat("ccc d LLL yyyy HH:mm");
  const rel = o.at < now ? '(pasada)' : `(en ${Math.round((o.at - now) / 3_600_000)} h)`;
  console.log(`${when} ${rel}`);
  for (const r of o.rules) console.log(`   → ${r.date} si se reserva con ${r.daysAhead} día(s) de anticipación`);
}

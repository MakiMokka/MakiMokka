import { DateTime } from 'luxon';
import type { CampaignConfig } from '../core/config.js';
import { localDateTime } from '../core/time.js';
import type { IsoDate } from '../core/types.js';

export interface ReleaseOpportunity {
  /** Instante UTC (ms) de la apertura. */
  at: number;
  atLocal: string;
  /** Fechas objetivo que podrían abrirse en este instante según las reglas candidatas. */
  dates: IsoDate[];
  /** Días de anticipación que producen esta oportunidad para cada fecha. */
  rules: Array<{ date: IsoDate; daysAhead: number }>;
}

/**
 * Calendario de oportunidades: para cada fecha objetivo D y cada regla candidata k
 * (días de anticipación) y cada hora candidata, la apertura es (D − k días) a esa hora local.
 * Como la regla real no está verificada, se consideran todas las candidatas.
 */
export function releaseCalendar(c: CampaignConfig): ReleaseOpportunity[] {
  const zone = c.restaurant.timezone;
  const byInstant = new Map<number, ReleaseOpportunity>();
  for (const t of c.targets) {
    for (const k of c.release.daysAheadCandidates) for (const time of c.release.times) {
      const day = DateTime.fromISO(t.date, { zone }).minus({ days: k }).toISODate()!;
      const at = localDateTime(day, time, zone);
      const ms = at.toMillis();
      const opp = byInstant.get(ms) ?? { at: ms, atLocal: at.toISO()!, dates: [], rules: [] };
      if (!opp.dates.includes(t.date)) opp.dates.push(t.date);
      opp.rules.push({ date: t.date, daysAhead: k });
      byInstant.set(ms, opp);
    }
  }
  return [...byInstant.values()].sort((a, b) => a.at - b.at);
}

/** Próxima apertura cuya ventana aún no termina. */
export function nextRelease(c: CampaignConfig, now: number): ReleaseOpportunity | null {
  const windowMs = c.polling.releaseWindowSeconds * 1000;
  return releaseCalendar(c).find((o) => o.at + windowMs > now) ?? null;
}

/** ¿Alguna regla candidata dice que la fecha ya podría estar abierta? (para monitorear cancelaciones) */
export function possiblyOpen(c: CampaignConfig, date: IsoDate, now: number): boolean {
  return releaseCalendar(c).some((o) => o.dates.includes(date) && o.at <= now);
}

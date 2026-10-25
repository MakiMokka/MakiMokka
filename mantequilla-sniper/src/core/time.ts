import { DateTime } from 'luxon';
import type { HHmm, IsoDate } from './types.js';

export function toMinutes(t: HHmm): number {
  const [h = '0', m = '0'] = t.split(':');
  return Number(h) * 60 + Number(m);
}

/** Normaliza textos de horario ("8:30 PM", "20.30", "20:30h") a HH:mm. Devuelve null si no se reconoce. */
export function normalizeTime(text: string): HHmm | null {
  const m = text.trim().match(/(\d{1,2})[:.h](\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[3]?.replace(/[\s.]/g, '').toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function localDateTime(date: IsoDate, time: HHmm, zone: string): DateTime {
  return DateTime.fromISO(`${date}T${time}`, { zone });
}

export function todayIn(zone: string, now: Date = new Date()): IsoDate {
  return DateTime.fromJSDate(now, { zone }).toISODate()!;
}

export function formatHumanDate(date: IsoDate, zone: string): string {
  return DateTime.fromISO(date, { zone }).setLocale('es-MX').toFormat("cccc d 'de' LLLL 'de' yyyy");
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('aborted'));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason ?? new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

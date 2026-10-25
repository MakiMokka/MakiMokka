import { rankCandidates, slotKey } from '../core/preferences.js';
import type { Candidate, DateAvailability, IsoDate, Slot, SlotStatus, Target } from '../core/types.js';
import type { RestaurantAdapter } from '../adapters/types.js';
import { errorMessage } from '../core/logger.js';

/**
 * Estado agregado de una fecha a partir de sus horarios. Un fallo de carga (ERROR/UNKNOWN)
 * nunca se convierte en "sin disponibilidad".
 */
export function aggregateStatus(slots: Slot[], fallback: SlotStatus): SlotStatus {
  if (slots.some((s) => s.status === 'AVAILABLE')) return 'AVAILABLE';
  if (slots.length === 0) return fallback;
  if (slots.every((s) => s.status === 'SOLD_OUT')) return 'SOLD_OUT';
  if (slots.some((s) => s.status === 'ERROR')) return 'ERROR';
  if (slots.some((s) => s.status === 'UNKNOWN')) return 'UNKNOWN';
  if (slots.every((s) => s.status === 'NOT_YET_RELEASED')) return 'NOT_YET_RELEASED';
  return 'UNAVAILABLE';
}

export interface AvailabilityChange {
  key: string;
  date: IsoDate;
  from: SlotStatus | null;
  to: SlotStatus;
}

export interface CheckResult {
  availability: DateAvailability[];
  candidates: Candidate[];
  changes: AvailabilityChange[];
  /** true si alguna fecha no pudo leerse con certeza. */
  degraded: boolean;
}

/**
 * Detección de disponibilidad: consulta al adapter, filtra fechas no deseadas,
 * deduplica, clasifica por prioridad y detecta cambios respecto a la consulta anterior.
 */
export class AvailabilityEngine {
  private last = new Map<string, SlotStatus>();

  constructor(
    private readonly adapter: RestaurantAdapter,
    private readonly targets: Target[],
    private readonly partySize: number,
  ) {}

  async check(dates: IsoDate[]): Promise<CheckResult> {
    const wanted = new Set(this.targets.map((t) => t.date));
    const query = dates.filter((d) => wanted.has(d));
    let raw: DateAvailability[];
    try {
      raw = await this.adapter.checkDates(query, this.partySize);
    } catch (err) {
      const now = new Date().toISOString();
      raw = query.map((date) => ({ date, status: 'ERROR' as const, slots: [], checkedAt: now, detail: errorMessage(err) }));
    }

    const availability = raw
      .filter((d) => wanted.has(d.date))
      .map((d) => {
        const seen = new Set<string>();
        const slots = d.slots.filter((s) => {
          const k = slotKey(s);
          if (s.date !== d.date || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return { ...d, slots, status: aggregateStatus(slots, d.status) };
      });

    const changes: AvailabilityChange[] = [];
    for (const day of availability) {
      const entries: Array<[string, SlotStatus]> =
        day.slots.length > 0 ? day.slots.map((s) => [slotKey(s), s.status]) : [[`${day.date}/*`, day.status]];
      for (const [key, to] of entries) {
        const from = this.last.get(key) ?? null;
        if (from !== to) changes.push({ key, date: day.date, from, to });
        this.last.set(key, to);
      }
    }

    return {
      availability,
      candidates: rankCandidates(this.targets, availability, this.partySize),
      changes,
      degraded: availability.some((d) => d.status === 'ERROR' || d.status === 'UNKNOWN'),
    };
  }
}

import { sortedTargets } from './config.js';
import { toMinutes } from './time.js';
import type { Candidate, DateAvailability, HHmm, Slot, Target } from './types.js';

/** ¿El horario cumple las restricciones de hora de la fecha objetivo? */
export function timeAllowed(target: Target, time: HHmm): boolean {
  const t = toMinutes(time);
  if (target.minTime && t < toMinutes(target.minTime)) return false;
  if (target.maxTime && t > toMinutes(target.maxTime)) return false;
  return true;
}

/**
 * Posición del horario dentro de su fecha: primero los preferidos en su orden,
 * después cualquier otro horario válido en orden cronológico.
 */
function timeRank(target: Target, time: HHmm): number {
  const preferred = target.preferredTimes ?? [];
  const idx = preferred.indexOf(time);
  if (idx >= 0) return idx;
  return preferred.length + toMinutes(time) / (24 * 60);
}

/**
 * Motor de selección: de todas las opciones disponibles al mismo tiempo, ordena por
 * prioridad de fecha y luego por preferencia de horario. Nunca espera a una fecha de
 * mayor prioridad: solo compara lo que está disponible ahora.
 */
export function rankCandidates(
  targets: Target[],
  availability: DateAvailability[],
  partySize: number,
): Candidate[] {
  const byDate = new Map(availability.map((a) => [a.date, a]));
  const out: Candidate[] = [];
  for (const target of sortedTargets(targets)) {
    const day = byDate.get(target.date);
    if (!day) continue;
    const seen = new Set<string>();
    for (const slot of day.slots) {
      if (slot.status !== 'AVAILABLE') continue;
      if (slot.date !== target.date) continue;
      if (slot.partySize !== partySize) continue;
      if (!timeAllowed(target, slot.time)) continue;
      if (seen.has(slot.time)) continue;
      seen.add(slot.time);
      out.push({ slot, target, rank: target.priority * 1000 + timeRank(target, slot.time) });
    }
  }
  return out.sort((a, b) => a.rank - b.rank);
}

export function bestCandidate(targets: Target[], availability: DateAvailability[], partySize: number): Candidate | null {
  return rankCandidates(targets, availability, partySize)[0] ?? null;
}

export function slotKey(slot: Pick<Slot, 'date' | 'time' | 'partySize'>): string {
  return `${slot.date}T${slot.time}/${slot.partySize}`;
}

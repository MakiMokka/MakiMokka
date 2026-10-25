import { sleep } from '../core/time.js';

export interface Clock {
  /** Hora corregida (ms epoch). */
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export class SystemClock implements Clock {
  offsetMs = 0;
  now(): number {
    return Date.now() + this.offsetMs;
  }
  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return sleep(ms, signal);
  }
}

/**
 * Estima la diferencia entre el reloj local y el del servidor usando la cabecera Date
 * (precisión de 1 s). Se toman varias muestras y se usa la de menor latencia.
 */
export async function measureServerOffset(
  url: string,
  samples = 3,
  fetchImpl: typeof fetch = fetch,
): Promise<{ offsetMs: number; rttMs: number } | null> {
  let best: { offsetMs: number; rttMs: number } | null = null;
  for (let i = 0; i < samples; i++) {
    try {
      const t0 = Date.now();
      const res = await fetchImpl(url, { method: 'HEAD', redirect: 'manual' });
      const t1 = Date.now();
      const header = res.headers.get('date');
      if (!header) continue;
      // La cabecera trunca a segundos: el instante real está en [server, server+1000).
      const server = Date.parse(header) + 500;
      const sample = { offsetMs: server - (t0 + t1) / 2, rttMs: t1 - t0 };
      if (!best || sample.rttMs < best.rttMs) best = sample;
    } catch {
      // Sin red: se reporta como null tras las muestras.
    }
  }
  return best;
}

/** Espera hasta el instante `at` del reloj dado; los últimos ms se esperan con pasos cortos. */
export async function waitUntil(clock: Clock, at: number, signal?: AbortSignal): Promise<void> {
  for (;;) {
    const remaining = at - clock.now();
    if (remaining <= 0) return;
    await clock.sleep(remaining > 200 ? remaining - 100 : Math.min(remaining, 5), signal);
  }
}

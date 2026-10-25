import { DateTime } from 'luxon';
import { SimulatedAdapter } from '../src/adapters/simulated.js';
import { loadCampaign, type RuntimeConfig } from '../src/core/config.js';
import { silentLogger } from '../src/core/logger.js';
import type { Mode } from '../src/core/types.js';
import { Notifier, type Channel, type Notification } from '../src/notify/notifier.js';
import { Orchestrator } from '../src/orchestrator.js';
import type { Clock } from '../src/scheduler/clock.js';
import { MemoryStore } from '../src/store/memory.js';

export const ZONE = 'America/Mexico_City';

export function at(local: string): number {
  return DateTime.fromISO(local, { zone: ZONE }).toMillis();
}

/** Reloj virtual: sleep avanza el tiempo al instante, sin esperas reales. */
export class VirtualClock implements Clock {
  constructor(public t: number) {}
  now() {
    return this.t;
  }
  async sleep(ms: number, signal?: AbortSignal) {
    if (signal?.aborted) throw new Error('aborted');
    this.t += Math.max(1, ms);
    await Promise.resolve();
  }
}

export class CaptureChannel implements Channel {
  name = 'capture';
  sent: Notification[] = [];
  async send(n: Notification) {
    this.sent.push(n);
  }
  types() {
    return this.sent.map((n) => n.type);
  }
}

export interface HarnessOpts {
  mode?: Mode;
  verified?: boolean;
  now?: number;
  store?: MemoryStore;
  adapter?: SimulatedAdapter;
}

export function harness(o: HarnessOpts = {}) {
  const campaign = loadCampaign('config/mantequilla.json');
  const cfg: RuntimeConfig = {
    campaign,
    // Datos ficticios: las pruebas nunca usan los datos reales del cliente.
    guest: { fullName: 'Persona Prueba', phone: '+52 55 1111 2222', email: 'prueba@example.com', partySize: 2, celebration: 'No' },
    mode: o.mode ?? 'AUTO',
    adapterVerified: o.verified ?? true,
    headless: true,
    healthPort: 0,
    stateDir: 'state-test',
  };
  const clock = new VirtualClock(o.now ?? at('2026-11-02T00:00:00'));
  const adapter = o.adapter ?? new SimulatedAdapter();
  const store = o.store ?? new MemoryStore();
  const channel = new CaptureChannel();
  const notifier = new Notifier(campaign.campaignId, store, [channel], silentLogger);
  const orch = new Orchestrator({ cfg, adapter, store, notifier, log: silentLogger, now: () => clock.now() });
  return { cfg, campaign, clock, adapter, store, channel, notifier, orch };
}

import { createServer } from 'node:http';
import { join } from 'node:path';
import { CoverManagerAdapter } from './adapters/covermanager/adapter.js';
import { loadRuntimeConfig } from './core/config.js';
import { createLogger, errorMessage } from './core/logger.js';
import { registerSensitive } from './core/redact.js';
import { channelsFromEnv, Notifier } from './notify/notifier.js';
import { Orchestrator } from './orchestrator.js';
import { SystemClock } from './scheduler/clock.js';
import { Scheduler } from './scheduler/scheduler.js';
import { MemoryStore } from './store/memory.js';
import { storeFromEnv } from './store/supabase.js';

async function main(): Promise<void> {
  const cfg = loadRuntimeConfig();
  registerSensitive(cfg.guest.fullName, cfg.guest.phone, cfg.guest.email);
  const log = createLogger({ campaign: cfg.campaign.campaignId });
  const store = storeFromEnv(process.env, () => new MemoryStore(join(cfg.stateDir, 'store.json')));
  const notifier = new Notifier(cfg.campaign.campaignId, store, channelsFromEnv(process.env, store), log);
  const clock = new SystemClock();
  const adapter = new CoverManagerAdapter({
    url: cfg.campaign.restaurant.url,
    timezone: cfg.campaign.restaurant.timezone,
    headless: cfg.headless,
    screenshotDir: join(cfg.stateDir, 'screens'),
    log,
  });
  const orch = new Orchestrator({ cfg, adapter, store, notifier, log, now: () => clock.now() });
  const scheduler = new Scheduler({
    campaign: cfg.campaign,
    orch,
    clock,
    notifier,
    log,
    applyOffset: (ms) => {
      clock.offsetMs = ms;
    },
  });

  const abort = new AbortController();
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      const body = { ok: true, state: orch.sm.state, nextReleaseAt: orch.nextReleaseAt, lastCheckAt: orch.lastCheckAt, mode: cfg.mode, adapterVerified: cfg.adapterVerified };
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    } else res.writeHead(404).end();
  });
  server.listen(cfg.healthPort);
  const heartbeat = setInterval(() => void orch.publishStatus(), 30_000);

  const shutdown = async (sig: string) => {
    log.info('Deteniendo worker', { sig });
    abort.abort(new Error(sig));
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  log.info('Worker iniciado', { mode: cfg.mode, adapterVerified: cfg.adapterVerified, targets: cfg.campaign.targets.map((t) => t.date) });
  try {
    const exit = await scheduler.run(abort.signal);
    log.info('Scheduler terminó', { exit });
  } catch (err) {
    log.error('Fallo fatal', { err: errorMessage(err) });
    await notifier.notify({ type: 'CRITICAL_ERROR', title: 'El worker se detuvo', body: errorMessage(err), urgent: true });
    process.exitCode = 1;
  } finally {
    clearInterval(heartbeat);
    await orch.publishStatus();
    await adapter.close();
    server.close();
  }
}

void main();

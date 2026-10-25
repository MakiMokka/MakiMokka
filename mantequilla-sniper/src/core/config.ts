import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { Guest, Mode, Target } from './types.js';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD');

const targetSchema = z.object({
  date: isoDate,
  priority: z.number().int().positive(),
  label: z.string(),
  minTime: hhmm.optional(),
  maxTime: hhmm.optional(),
  preferredTimes: z.array(hhmm).optional(),
  referenceTimes: z.array(hhmm).optional(),
});

export const campaignSchema = z.object({
  campaignId: z.string().min(1),
  restaurant: z.object({
    name: z.string(),
    slug: z.string(),
    platform: z.enum(['covermanager']),
    url: z.string().url(),
    timezone: z.string(),
  }),
  partySize: z.number().int().min(1).max(20),
  release: z.object({
    time: hhmm,
    daysAheadCandidates: z.array(z.number().int().min(0).max(365)).min(1),
    note: z.string().optional(),
  }),
  polling: z.object({
    /** Piso absoluto entre consultas a la plataforma. Ningún otro intervalo puede ser menor. */
    minIntervalMs: z.number().int().min(2000),
    releaseWindowSeconds: z.number().int().min(10).max(1800),
    releasePollMs: z.number().int(),
    cancellationPollMs: z.number().int(),
    maxConsecutiveErrors: z.number().int().min(1),
  }),
  targets: z.array(targetSchema).min(1),
});

export type CampaignConfig = z.infer<typeof campaignSchema>;

export interface RuntimeConfig {
  campaign: CampaignConfig;
  guest: Guest;
  mode: Mode;
  /** Solo true después de validar el adapter contra la página real (ver docs/RUNBOOK.md). */
  adapterVerified: boolean;
  headless: boolean;
  healthPort: number;
  stateDir: string;
}

export function loadCampaign(path: string): CampaignConfig {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const campaign = campaignSchema.parse(raw);
  const floor = campaign.polling.minIntervalMs;
  // Nunca consultar más rápido que el piso configurado.
  campaign.polling.releasePollMs = Math.max(campaign.polling.releasePollMs, floor);
  campaign.polling.cancellationPollMs = Math.max(campaign.polling.cancellationPollMs, floor);
  const priorities = new Set(campaign.targets.map((t) => t.priority));
  if (priorities.size !== campaign.targets.length) throw new Error('Las prioridades de las fechas deben ser únicas');
  return campaign;
}

const guestEnv = z.object({
  GUEST_FULL_NAME: z.string().min(2),
  GUEST_PHONE: z.string().regex(/^\+?[\d\s-]{8,20}$/, 'Teléfono inválido'),
  GUEST_EMAIL: z.string().email(),
});

/** Los datos del cliente solo viven en variables de entorno, nunca en el repositorio. */
export function loadGuest(env: NodeJS.ProcessEnv, partySize: number): Guest {
  const parsed = guestEnv.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Faltan o son inválidos los datos del cliente en el entorno: ${missing}`);
  }
  return {
    fullName: parsed.data.GUEST_FULL_NAME.trim(),
    phone: parsed.data.GUEST_PHONE.trim(),
    email: parsed.data.GUEST_EMAIL.trim(),
    partySize,
    celebration: 'No',
  };
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const campaign = loadCampaign(env.CAMPAIGN_CONFIG ?? 'config/mantequilla.json');
  return {
    campaign,
    guest: loadGuest(env, campaign.partySize),
    mode: env.BOOKING_MODE === 'AUTO' ? 'AUTO' : 'ASSISTED',
    adapterVerified: env.COVERMANAGER_ADAPTER_VERIFIED === 'true',
    headless: env.HEADLESS !== 'false',
    healthPort: Number(env.PORT ?? 8080),
    stateDir: env.STATE_DIR ?? 'state',
  };
}

export function sortedTargets(targets: Target[]): Target[] {
  return [...targets].sort((a, b) => a.priority - b.priority);
}

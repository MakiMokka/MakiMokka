import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Transition } from '../core/stateMachine.js';
import type { Attempt, AttemptStatus, DateAvailability, Reservation } from '../core/types.js';
import type { PushSubscriptionRecord, RuntimeSettings, Store, StoredEvent, WorkerStatus } from './types.js';

/**
 * Store en Supabase (Postgres). La unicidad de la reserva por campaña y el lock se
 * garantizan en la base de datos (ver supabase/migrations/001_init.sql), no en el proceso.
 * Usa la service-role key: solo debe vivir en el worker, nunca en el navegador.
 */
export class SupabaseStore implements Store {
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  private check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    return res.data;
  }

  async getConfirmed(campaignId: string): Promise<Reservation | null> {
    const row = this.check(
      await this.db.from('reservations').select('*').eq('campaign_id', campaignId).maybeSingle(),
    ) as Record<string, string | number> | null;
    if (!row) return null;
    return {
      campaignId: String(row.campaign_id),
      restaurant: String(row.restaurant),
      date: String(row.date),
      time: String(row.time).slice(0, 5),
      partySize: Number(row.party_size),
      guestName: String(row.guest_name),
      confirmationId: String(row.confirmation_id),
      status: 'CONFIRMED',
      confirmedAt: String(row.confirmed_at),
      evidence: String(row.evidence),
    };
  }

  async saveReservation(r: Reservation): Promise<boolean> {
    const res = await this.db.from('reservations').insert({
      campaign_id: r.campaignId,
      restaurant: r.restaurant,
      date: r.date,
      time: r.time,
      party_size: r.partySize,
      guest_name: r.guestName,
      confirmation_id: r.confirmationId,
      status: r.status,
      confirmed_at: r.confirmedAt,
      evidence: r.evidence,
    });
    if (res.error?.code === '23505') return false; // unique_violation: ya hay reserva
    this.check(res);
    return true;
  }

  async acquireBookingLock(campaignId: string, holder: string, ttlMs: number): Promise<boolean> {
    const data = this.check(
      await this.db.rpc('acquire_booking_lock', { p_campaign_id: campaignId, p_holder: holder, p_ttl_ms: ttlMs }),
    );
    return data === true;
  }

  async releaseBookingLock(campaignId: string, holder: string): Promise<void> {
    this.check(await this.db.from('booking_locks').delete().eq('campaign_id', campaignId).eq('holder', holder));
  }

  async createAttempt(a: Omit<Attempt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Attempt> {
    const row = this.check(
      await this.db
        .from('attempts')
        .insert({ campaign_id: a.campaignId, date: a.date, time: a.time, status: a.status, detail: a.detail ?? null })
        .select('*')
        .single(),
    ) as Record<string, string>;
    return mapAttempt(row);
  }

  async updateAttempt(id: string, status: AttemptStatus, detail?: string): Promise<void> {
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (detail !== undefined) patch.detail = detail;
    this.check(await this.db.from('attempts').update(patch).eq('id', id));
  }

  async listUnresolvedAttempts(campaignId: string): Promise<Attempt[]> {
    const rows = this.check(
      await this.db.from('attempts').select('*').eq('campaign_id', campaignId).in('status', ['SUBMITTED', 'UNCERTAIN']),
    ) as Record<string, string>[];
    return rows.map(mapAttempt);
  }

  async listAttempts(campaignId: string): Promise<Attempt[]> {
    const rows = this.check(
      await this.db.from('attempts').select('*').eq('campaign_id', campaignId).order('created_at'),
    ) as Record<string, string>[];
    return rows.map(mapAttempt);
  }

  async logTransition(campaignId: string, t: Transition): Promise<void> {
    this.check(
      await this.db.from('transitions').insert({ campaign_id: campaignId, from_state: t.from, to_state: t.to, reason: t.reason, at: t.at }),
    );
  }

  async logEvent(e: Omit<StoredEvent, 'id' | 'at'>): Promise<StoredEvent> {
    const row = this.check(
      await this.db
        .from('events')
        .insert({ campaign_id: e.campaignId, type: e.type, message: e.message, data: e.data ?? null })
        .select('*')
        .single(),
    ) as Record<string, unknown>;
    return { ...e, id: String(row.id), at: String(row.at) };
  }

  async saveAvailability(campaignId: string, snapshot: DateAvailability[]): Promise<void> {
    if (snapshot.length === 0) return;
    this.check(
      await this.db.from('availability').upsert(
        snapshot.map((d) => ({
          campaign_id: campaignId,
          date: d.date,
          status: d.status,
          slots: d.slots.filter((s) => s.status === 'AVAILABLE').map((s) => s.time),
          checked_at: d.checkedAt,
          detail: d.detail ?? null,
        })),
        { onConflict: 'campaign_id,date' },
      ),
    );
  }

  async setWorkerStatus(s: WorkerStatus): Promise<void> {
    this.check(
      await this.db.from('worker_status').upsert({
        campaign_id: s.campaignId,
        state: s.state,
        next_release_at: s.nextReleaseAt,
        last_check_at: s.lastCheckAt,
        heartbeat_at: s.heartbeatAt,
        clock_offset_ms: s.clockOffsetMs ?? null,
      }),
    );
  }

  async getRuntimeSettings(campaignId: string): Promise<RuntimeSettings | null> {
    const row = this.check(
      await this.db.from('settings').select('mode,paused').eq('campaign_id', campaignId).maybeSingle(),
    ) as { mode: 'AUTO' | 'ASSISTED'; paused: boolean } | null;
    return row ? { mode: row.mode, paused: row.paused } : null;
  }

  async listPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
    const rows = this.check(await this.db.from('push_subscriptions').select('endpoint,p256dh,auth')) as Array<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }>;
    return rows.map((r) => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }));
  }
}

function mapAttempt(row: Record<string, string>): Attempt {
  return {
    id: row.id!,
    campaignId: row.campaign_id!,
    date: row.date!,
    time: String(row.time).slice(0, 5),
    status: row.status as AttemptStatus,
    createdAt: row.created_at!,
    updatedAt: row.updated_at!,
    detail: row.detail ?? undefined,
  };
}

export function storeFromEnv(env: NodeJS.ProcessEnv, fallback: () => Store): Store {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) return new SupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  return fallback();
}

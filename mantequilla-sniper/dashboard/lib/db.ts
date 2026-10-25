import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import campaign from '../../config/mantequilla.json';

export { campaign };
export const CAMPAIGN_ID = campaign.campaignId;

let client: SupabaseClient | null = null;

export function db(): SupabaseClient | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  client ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return client;
}

export interface WorkerStatusRow {
  state: string;
  next_release_at: string | null;
  last_check_at: string | null;
  heartbeat_at: string;
  clock_offset_ms: number | null;
}
export interface AvailabilityRow {
  date: string;
  status: string;
  slots: string[];
  checked_at: string;
  detail: string | null;
}
export interface ReservationRow {
  date: string;
  time: string;
  party_size: number;
  guest_name: string;
  confirmation_id: string;
  confirmed_at: string;
  evidence: string;
}
export interface EventRow {
  id: string;
  type: string;
  message: string;
  at: string;
}
export interface AttemptRow {
  id: string;
  date: string;
  time: string;
  status: string;
  detail: string | null;
  created_at: string;
  updated_at: string;
}
export interface TransitionRow {
  id: number;
  from_state: string;
  to_state: string;
  reason: string;
  at: string;
}

export async function overview() {
  const d = db();
  if (!d) return null;
  const [status, availability, reservation, settings] = await Promise.all([
    d.from('worker_status').select('*').eq('campaign_id', CAMPAIGN_ID).maybeSingle(),
    d.from('availability').select('*').eq('campaign_id', CAMPAIGN_ID),
    d.from('reservations').select('*').eq('campaign_id', CAMPAIGN_ID).maybeSingle(),
    d.from('settings').select('mode,paused').eq('campaign_id', CAMPAIGN_ID).maybeSingle(),
  ]);
  return {
    status: status.data as WorkerStatusRow | null,
    availability: (availability.data ?? []) as AvailabilityRow[],
    reservation: reservation.data as ReservationRow | null,
    settings: (settings.data as { mode: 'AUTO' | 'ASSISTED'; paused: boolean } | null) ?? { mode: 'ASSISTED' as const, paused: false },
  };
}

export async function activity() {
  const d = db();
  if (!d) return null;
  const [events, attempts, transitions] = await Promise.all([
    d.from('events').select('id,type,message,at').eq('campaign_id', CAMPAIGN_ID).order('at', { ascending: false }).limit(100),
    d.from('attempts').select('*').eq('campaign_id', CAMPAIGN_ID).order('created_at', { ascending: false }).limit(50),
    d.from('transitions').select('id,from_state,to_state,reason,at').eq('campaign_id', CAMPAIGN_ID).order('at', { ascending: false }).limit(100),
  ]);
  return {
    events: (events.data ?? []) as EventRow[],
    attempts: (attempts.data ?? []) as AttemptRow[],
    transitions: (transitions.data ?? []) as TransitionRow[],
  };
}

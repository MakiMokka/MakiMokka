'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { COOKIE, sessionToken, isValidSession } from '@/lib/auth';
import { CAMPAIGN_ID, campaign, db } from '@/lib/db';

async function requireSession() {
  if (!(await isValidSession((await cookies()).get(COOKIE)?.value))) redirect('/login');
  const d = db();
  if (!d) throw new Error('Supabase no está configurado');
  return d;
}

export async function login(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  if (!process.env.DASHBOARD_PASSWORD || password !== process.env.DASHBOARD_PASSWORD) redirect('/login?error=1');
  (await cookies()).set(COOKIE, await sessionToken(password), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' });
  redirect('/');
}

export async function updateSettings(formData: FormData) {
  const d = await requireSession();
  const mode = formData.get('mode') === 'AUTO' ? 'AUTO' : 'ASSISTED';
  const paused = formData.get('paused') === 'on';
  const { error } = await d.from('settings').upsert({ campaign_id: CAMPAIGN_ID, mode, paused, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

/** Resolver un intento enviado sin confirmación verificable, tras revisar el correo de CoverManager. */
export async function resolveAttempt(formData: FormData) {
  const d = await requireSession();
  const id = String(formData.get('attemptId'));
  const verdict = String(formData.get('verdict'));
  const { data: attempt } = await d.from('attempts').select('*').eq('id', id).eq('campaign_id', CAMPAIGN_ID).single();
  if (!attempt || !['UNCERTAIN', 'SUBMITTED'].includes(attempt.status)) throw new Error('Intento no resoluble');

  if (verdict === 'confirmed') {
    const confirmationId = String(formData.get('confirmationId') ?? '').trim();
    if (!confirmationId) throw new Error('Falta el localizador oficial');
    const { error } = await d.from('reservations').insert({
      campaign_id: CAMPAIGN_ID,
      restaurant: campaign.restaurant.name,
      date: attempt.date,
      time: attempt.time,
      party_size: campaign.partySize,
      guest_name: process.env.GUEST_FULL_NAME ?? '(ver correo)',
      confirmation_id: confirmationId,
      status: 'CONFIRMED',
      confirmed_at: new Date().toISOString(),
      evidence: 'Confirmación verificada manualmente desde el dashboard',
    });
    if (error && error.code !== '23505') throw new Error(error.message);
    await d.from('attempts').update({ status: 'CONFIRMED', detail: confirmationId, updated_at: new Date().toISOString() }).eq('id', id);
  } else {
    await d.from('attempts').update({ status: 'FAILED', detail: 'Verificado manualmente: no se registró', updated_at: new Date().toISOString() }).eq('id', id);
  }
  revalidatePath('/', 'layout');
}

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const d = await requireSession();
  const { error } = await d.from('push_subscriptions').upsert({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
  if (error) throw new Error(error.message);
}

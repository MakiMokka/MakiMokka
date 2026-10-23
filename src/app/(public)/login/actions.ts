'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { audit } from '@/lib/audit';
import { decideAccess, safeRedirectPath } from '@/lib/auth/access';
import { getServerEnv } from '@/lib/env/server';
import { logger } from '@/lib/logging/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import type { LoginState } from './state';

const emailSchema = z.email().max(320);
const codeSchema = z.string().regex(/^\d{6,10}$/);
const RATE_LIMIT_CODES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);

/**
 * Email one-time-code sign-in (works inside an installed iOS PWA, unlike
 * magic links which open in Safari).
 *
 * - shouldCreateUser: false — nobody can self-register.
 * - Responses never reveal whether an email has an account.
 * - After verification the user id must be on the allowlist, otherwise the
 *   session is revoked immediately.
 */
export async function loginAction(previous: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get('intent');
  if (intent === 'reset') return { step: 'email', email: '', message: null };

  const emailResult = emailSchema.safeParse(
    String(formData.get('email') ?? '')
      .trim()
      .toLowerCase(),
  );
  if (!emailResult.success) return { ...previous, step: 'email', message: 'invalidEmail' };
  const email = emailResult.data;
  const supabase = await createSupabaseServerClient();

  if (intent === 'request') {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error && error.code && RATE_LIMIT_CODES.has(error.code)) {
      return { step: 'email', email, message: 'rateLimited' };
    }
    if (error && (error.status ?? 0) >= 500) {
      logger.warn('auth.otp_request_failed', { errorCode: error.code ?? 'unknown' });
      return { step: 'email', email, message: 'unavailable' };
    }
    // Same response whether or not the address belongs to a user.
    return { step: 'code', email, message: 'codeSent' };
  }

  if (intent === 'verify') {
    const codeResult = codeSchema.safeParse(String(formData.get('code') ?? '').replace(/\s/g, ''));
    if (!codeResult.success) return { step: 'code', email, message: 'invalidCode' };

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: codeResult.data,
      type: 'email',
    });
    if (error || !data.user) {
      if (error?.code && RATE_LIMIT_CODES.has(error.code))
        return { step: 'code', email, message: 'rateLimited' };
      return { step: 'code', email, message: 'failed' };
    }

    const userId = data.user.id;
    if (decideAccess(userId, getServerEnv().allowedUserIds) !== 'authorized') {
      await supabase.auth.signOut({ scope: 'global' });
      await audit({
        userId,
        actor: 'system',
        eventType: 'auth.sign_in_denied',
        metadata: { reason: 'not_allowlisted' },
      });
      redirect('/unauthorized');
    }

    await audit({
      userId,
      actor: 'user',
      eventType: 'auth.sign_in',
      metadata: { provider: 'email_otp' },
    });
    redirect(safeRedirectPath(String(formData.get('next') ?? '')));
  }

  return { ...previous, message: null };
}

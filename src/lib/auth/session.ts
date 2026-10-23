import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { ApiError } from '@/lib/api/errors';
import { getServerEnv } from '@/lib/env/server';
import { createSupabaseServerClient, type UserSupabaseClient } from '@/lib/supabase/server';

import { decideAccess } from './access';

export type AuthContext =
  | { status: 'anonymous' }
  | { status: 'unauthorized'; userId: string }
  | {
      status: 'authorized';
      userId: string;
      email: string | null;
      sessionId: string | null;
      supabase: UserSupabaseClient;
    };

export type AuthorizedContext = Extract<AuthContext, { status: 'authorized' }>;

/**
 * Resolve the caller's identity once per request. The JWT is verified with
 * getClaims(); identity is never taken from unverified cookie contents.
 */
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const env = getServerEnv();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = !error && data?.claims ? data.claims : null;
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;

  const decision = decideAccess(userId, env.allowedUserIds);
  if (decision === 'anonymous' || !userId) return { status: 'anonymous' };
  if (decision === 'unauthorized') return { status: 'unauthorized', userId };
  return {
    status: 'authorized',
    userId,
    email: typeof claims?.email === 'string' ? claims.email : null,
    sessionId: typeof claims?.session_id === 'string' ? claims.session_id : null,
    supabase,
  };
});

/** For pages, layouts and server actions. Redirects instead of rendering. */
export async function requireAuthorizedUser(): Promise<AuthorizedContext> {
  const context = await getAuthContext();
  if (context.status === 'anonymous') redirect('/login');
  if (context.status === 'unauthorized') redirect('/unauthorized');
  return context;
}

/** For route handlers. Throws ApiError, which withApiHandler turns into 401/403. */
export async function requireAuthorizedApiUser(): Promise<AuthorizedContext> {
  const context = await getAuthContext();
  if (context.status === 'anonymous') throw new ApiError('unauthenticated');
  if (context.status === 'unauthorized') throw new ApiError('forbidden');
  return context;
}

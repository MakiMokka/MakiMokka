import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/lib/db/types';
import { getServerEnv } from '@/lib/env/server';

import { sessionCookieOptions } from './cookie-options';

/**
 * Request-scoped Supabase client acting as the signed-in user. All queries
 * through it are subject to RLS. Never create a service-role client: this
 * project does not use the service-role key at all.
 */
export async function createSupabaseServerClient() {
  // Read request data first so static prerendering bails out before env access.
  const cookieStore = await cookies();
  const env = getServerEnv();
  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookieOptions: sessionCookieOptions(env.nodeEnv === 'production'),
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the
          // session on every request, so this is safe to ignore here.
        }
      },
    },
  });
}

export type UserSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

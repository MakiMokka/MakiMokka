import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

import type { Database } from '@/lib/db/types';
import type { ServerEnv } from '@/lib/env/schema';

import { sessionCookieOptions } from './cookie-options';

/**
 * Refresh the Supabase session for this request (if any) and return the
 * verified user id. Cookie writes are applied to both the forwarded request
 * and the outgoing response.
 */
export async function refreshSession(
  request: NextRequest,
  getResponse: () => NextResponse,
  env: ServerEnv,
): Promise<{ userId: string | null; response: NextResponse }> {
  let response = getResponse();
  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookieOptions: sessionCookieOptions(env.nodeEnv === 'production'),
    auth: { flowType: 'pkce', detectSessionInUrl: false },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = getResponse();
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getClaims() verifies the JWT (signature + expiry) rather than trusting
  // the cookie contents, refreshing the session first when needed.
  const { data, error } = await supabase.auth.getClaims();
  const sub = !error && data?.claims ? data.claims.sub : null;
  return { userId: typeof sub === 'string' ? sub : null, response };
}

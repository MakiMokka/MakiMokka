import { NextResponse, type NextRequest } from 'next/server';

import { decideAccess, isPublicPath } from '@/lib/auth/access';
import { parseServerEnv, type ServerEnv } from '@/lib/env/schema';
import { buildPageCsp, generateNonce } from '@/lib/security/csp';
import { refreshSession } from '@/lib/supabase/proxy-session';

let env: ServerEnv | undefined;

/**
 * Runs before every page and API request:
 *   1. issues a per-request CSP nonce,
 *   2. refreshes the Supabase session cookie,
 *   3. redirects pages optimistically (anonymous → /login, not allowlisted →
 *      /unauthorized).
 *
 * This is NOT the security boundary: layouts, server actions and route
 * handlers re-check authorization themselves (src/lib/auth/session.ts).
 */
export async function proxy(request: NextRequest) {
  env ??= parseServerEnv(process.env);
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  const nonce = generateNonce();
  const csp = buildPageCsp({ nonce, isDev: env.nodeEnv === 'development' });

  const buildResponse = () => {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    if (!isApi) headers.set('Content-Security-Policy', csp);
    const response = NextResponse.next({ request: { headers } });
    if (!isApi) response.headers.set('Content-Security-Policy', csp);
    return response;
  };

  const { userId, response } = await refreshSession(request, buildResponse, env);

  if (isApi || isPublicPath(pathname)) return response;

  const decision = decideAccess(userId, env.allowedUserIds);
  if (decision === 'authorized') return response;

  const target = request.nextUrl.clone();
  target.search = '';
  if (decision === 'anonymous') {
    target.pathname = '/login';
    if (pathname !== '/') target.searchParams.set('next', pathname);
  } else {
    target.pathname = '/unauthorized';
  }
  const redirect = NextResponse.redirect(target);
  // Preserve refreshed/cleared session cookies on the redirect.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set('Content-Security-Policy', csp);
  return redirect;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|icons/|sw\\.js|offline\\.css|robots\\.txt|favicon\\.ico|icon\\.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * Supabase session cookies are HttpOnly: no browser code in this app ever
 * reads the session, so tokens are unreachable from JavaScript (XSS cannot
 * exfiltrate them) and nothing is kept in localStorage.
 */
export function sessionCookieOptions(isProduction: boolean): CookieOptionsWithName {
  return {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  };
}

import { isUserAllowed } from './allowlist';

export type AccessDecision = 'anonymous' | 'unauthorized' | 'authorized';

/**
 * Single decision point for app access: a verified Supabase user id that is
 * on the explicit allowlist. Row-level security enforces a second,
 * database-side allowlist (app_private.authorized_users).
 */
export function decideAccess(
  userId: string | null | undefined,
  allowlist: ReadonlySet<string>,
): AccessDecision {
  if (!userId) return 'anonymous';
  return isUserAllowed(allowlist, userId) ? 'authorized' : 'unauthorized';
}

/** Paths reachable without an authorized session. Keep this list short. */
const PUBLIC_PATHS = [
  '/login',
  '/unauthorized',
  '/offline.html',
  '/manifest.webmanifest',
  '/api/health',
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Only allow same-site relative redirects ("/inbox"), never "//evil" or absolute URLs. */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback = '/inbox',
): string {
  if (
    !candidate ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.startsWith('/\\')
  ) {
    return fallback;
  }
  if (/[\u0000-\u001f]/.test(candidate)) return fallback;
  return candidate;
}

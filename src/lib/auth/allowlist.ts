import { isUuid } from '@/lib/validation';

/**
 * Parse AUTH_ALLOWED_USER_IDS: a comma/whitespace separated list of Supabase
 * Auth user IDs. Invalid entries are a configuration error, not something to
 * silently skip, because a typo would otherwise lock the owner out or (worse)
 * hide a misconfiguration.
 */
export function parseAllowlist(raw: string | undefined): ReadonlySet<string> {
  const entries = (raw ?? '')
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const invalid = entries.filter((entry) => !isUuid(entry));
  if (invalid.length > 0) {
    throw new Error(`AUTH_ALLOWED_USER_IDS contains ${invalid.length} invalid user ID(s)`);
  }
  return new Set(entries.map((entry) => entry.toLowerCase()));
}

export function isUserAllowed(
  allowlist: ReadonlySet<string>,
  userId: string | null | undefined,
): boolean {
  if (!userId || !isUuid(userId)) return false;
  return allowlist.has(userId.toLowerCase());
}

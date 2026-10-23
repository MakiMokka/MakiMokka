import 'server-only';

import { requireAuthorizedUser } from '@/lib/auth/session';
import { getProfile } from '@/lib/db/queries';
import { getI18n } from '@/lib/i18n/server';

/**
 * Common context for authenticated pages. Each page calls this itself
 * (layouts do not run for every request in a way pages can rely on), so
 * authorization is re-checked at the page boundary.
 */
export async function getPageContext() {
  const auth = await requireAuthorizedUser();
  const [{ t, locale }, profile] = await Promise.all([getI18n(), getProfile(auth)]);
  const timeZone = profile.ok && profile.data ? profile.data.time_zone : 'UTC';
  return { auth, t, locale, timeZone, profile };
}

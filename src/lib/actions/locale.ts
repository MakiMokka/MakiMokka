'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { audit } from '@/lib/audit';
import { safeRedirectPath } from '@/lib/auth/access';
import { getAuthContext } from '@/lib/auth/session';
import { updateProfilePreferences } from '@/lib/db/queries';
import { getServerEnv } from '@/lib/env/server';
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/config';

export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get('locale');
  const returnTo = safeRedirectPath(String(formData.get('returnTo') ?? ''), '/settings/language');
  if (!isLocale(locale)) redirect(returnTo);

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: getServerEnv().nodeEnv === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  // Re-check authorization inside the action; never rely on the proxy alone.
  const auth = await getAuthContext();
  if (auth.status === 'authorized') {
    const result = await updateProfilePreferences(auth, { locale });
    if (result.ok) {
      await audit({
        userId: auth.userId,
        actor: 'user',
        eventType: 'settings.locale_changed',
        metadata: { locale },
      });
    }
  }
  redirect(returnTo);
}

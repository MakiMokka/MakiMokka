import 'server-only';

import { cookies, headers } from 'next/headers';
import { cache } from 'react';

import { getAuthContext } from '@/lib/auth/session';
import { getProfile } from '@/lib/db/queries';

import { LOCALE_COOKIE, resolveLocale, type AppLocale } from './config';
import { getDictionary, type Dictionary } from './dictionaries';

/** Locale for this request: profile → cookie → Accept-Language → English. */
export const getRequestLocale = cache(async (): Promise<AppLocale> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const auth = await getAuthContext();
  let profileLocale: string | null = null;
  if (auth.status === 'authorized') {
    const profile = await getProfile(auth);
    profileLocale = profile.ok ? (profile.data?.locale ?? null) : null;
  }
  return resolveLocale({
    profileLocale,
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  });
});

export async function getI18n(): Promise<{ locale: AppLocale; t: Dictionary }> {
  const locale = await getRequestLocale();
  return { locale, t: getDictionary(locale) };
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Brand } from '@/components/brand';
import { LanguageSwitch } from '@/components/language-switch';
import { safeRedirectPath } from '@/lib/auth/access';
import { getAuthContext } from '@/lib/auth/session';
import { getI18n } from '@/lib/i18n/server';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ t, locale }, auth, params] = await Promise.all([
    getI18n(),
    getAuthContext(),
    searchParams,
  ]);
  if (auth.status === 'authorized') redirect('/inbox');
  if (auth.status === 'unauthorized') redirect('/unauthorized');

  return (
    <main className="pt-safe pb-safe px-safe flex min-h-dvh flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-8 py-10">
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- static same-origin icon */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={72}
            height={72}
            className="mx-auto rounded-[16px]"
          />
          <Brand name={t.app.name} versionTemplate={t.app.version} size="lg" />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-[22px] font-semibold">{t.login.title}</h1>
          <p className="text-secondary-label text-[15px]">{t.login.subtitle}</p>
        </div>
        <LoginForm t={t.login} next={safeRedirectPath(params.next)} />
        <LanguageSwitch
          locale={locale}
          labels={{ en: t.language.english, es: t.language.spanish }}
          returnTo="/login"
        />
      </div>
    </main>
  );
}

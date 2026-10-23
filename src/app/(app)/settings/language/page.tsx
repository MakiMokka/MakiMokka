import type { Metadata } from 'next';

import { CheckIcon } from '@/components/icons';
import { PageBody, PageHeader } from '@/components/page-header';
import { setLocaleAction } from '@/lib/actions/locale';
import { LOCALES } from '@/lib/i18n/config';
import { getPageContext } from '@/lib/page-context';

export const metadata: Metadata = { title: 'Language' };

export default async function LanguagePage() {
  const { t, locale } = await getPageContext();
  const names = { en: t.language.english, es: t.language.spanish };
  return (
    <>
      <PageHeader title={t.language.title} back={{ href: '/settings', label: t.settings.title }} />
      <PageBody>
        <section>
          <form action={setLocaleAction}>
            <input type="hidden" name="returnTo" value="/settings/language" />
            <ul className="bg-cell [&>li+li]:border-separator overflow-hidden rounded-[10px] [&>li+li]:border-t-[0.5px]">
              {LOCALES.map((value) => (
                <li key={value}>
                  <button
                    type="submit"
                    name="locale"
                    value={value}
                    lang={value}
                    aria-pressed={value === locale}
                    className="active:bg-fill flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[17px]"
                  >
                    <span className="flex-1">{names[value]}</span>
                    {value === locale ? <CheckIcon className="text-tint size-5" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </form>
          <p className="text-secondary-label px-4 pt-1.5 text-[13px]">{t.language.description}</p>
        </section>
      </PageBody>
    </>
  );
}

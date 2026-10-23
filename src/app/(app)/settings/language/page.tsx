import type { Metadata } from 'next';

import { CheckIcon } from '@/components/icons';
import { PageBody, PageHeader } from '@/components/page-header';
import { setLocaleAction } from '@/lib/actions/locale';
import { LOCALES } from '@/lib/i18n/config';
import { getPageContext } from '@/lib/page-context';
import { ui } from '@/components/styles';

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
            <ul className="surface-reading rounded-container [&>li+li]:border-line overflow-hidden [&>li+li]:border-t-[0.5px]">
              {LOCALES.map((value) => (
                <li key={value}>
                  <button
                    type="submit"
                    name="locale"
                    value={value}
                    lang={value}
                    aria-pressed={value === locale}
                    className="active:bg-surface-2 hover:bg-surface-2 text-body text-fg flex min-h-12 w-full items-center px-4 py-3 text-left"
                  >
                    <span className="flex-1">{names[value]}</span>
                    {value === locale ? <CheckIcon className="text-accent size-5" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </form>
          <p className={ui.footnote}>{t.language.description}</p>
        </section>
      </PageBody>
    </>
  );
}

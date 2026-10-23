import { setLocaleAction } from '@/lib/actions/locale';
import type { AppLocale } from '@/lib/i18n/config';

/** Compact segmented control used on the sign-in screen. */
export function LanguageSwitch({
  locale,
  labels,
  returnTo,
}: {
  locale: AppLocale;
  labels: Record<AppLocale, string>;
  returnTo: string;
}) {
  return (
    <form action={setLocaleAction} className="flex justify-center">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="bg-surface-2 inline-flex rounded-full p-1" role="group">
        {(Object.keys(labels) as AppLocale[]).map((value) => (
          <button
            key={value}
            type="submit"
            name="locale"
            value={value}
            aria-pressed={value === locale}
            lang={value}
            className={`text-subhead min-h-9 rounded-full px-4 font-medium ${
              value === locale ? 'surface-control text-fg' : 'text-fg-muted'
            }`}
          >
            {labels[value]}
          </button>
        ))}
      </div>
    </form>
  );
}

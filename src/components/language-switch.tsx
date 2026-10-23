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
      <div className="bg-fill inline-flex rounded-[9px] p-0.5" role="group">
        {(Object.keys(labels) as AppLocale[]).map((value) => (
          <button
            key={value}
            type="submit"
            name="locale"
            value={value}
            aria-pressed={value === locale}
            lang={value}
            className={`min-h-9 rounded-[7px] px-4 text-[13px] font-medium ${
              value === locale ? 'bg-cell shadow-sm' : 'text-secondary-label'
            }`}
          >
            {labels[value]}
          </button>
        ))}
      </div>
    </form>
  );
}

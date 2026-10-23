export const LOCALES = ['en', 'es'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'en';
export const LOCALE_COOKIE = 'um_locale';

export function isLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Pick the best supported locale from an Accept-Language header. */
export function matchAcceptLanguage(header: string | null | undefined): AppLocale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return {
        base: tag.toLowerCase().split('-')[0] ?? '',
        weight: Number.isFinite(weight) ? weight : 0,
      };
    })
    .filter((entry) => entry.base && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  for (const entry of ranked) {
    if (isLocale(entry.base)) return entry.base;
  }
  return null;
}

/** Explicit choice (cookie / profile) wins, then the browser, then English. */
export function resolveLocale(input: {
  profileLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  if (isLocale(input.profileLocale)) return input.profileLocale;
  if (isLocale(input.cookieLocale)) return input.cookieLocale;
  return matchAcceptLanguage(input.acceptLanguage) ?? DEFAULT_LOCALE;
}

/** Minimal "{name}" interpolation. Values are plain text (React escapes them). */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

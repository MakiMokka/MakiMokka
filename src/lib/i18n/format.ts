import type { AppLocale } from './config';

const LOCALE_TAGS: Record<AppLocale, string> = { en: 'en-US', es: 'es-MX' };

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: AppLocale,
  timeZone = 'UTC',
): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC',
  }).format(date);
}

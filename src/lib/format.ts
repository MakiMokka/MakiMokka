import type { Cents, ISODate, ISODateTime } from '../domain/types';

const LOCALE = 'es-MX';

const currency = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

export function formatMoney(cents: Cents): string {
  return currency.format(cents / 100);
}

function parts(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

const shortDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const shortDateYear = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const longDate = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const dateTime = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "20 oct" en el año en curso, "20 oct 2025" en otros años. */
export function formatDate(iso: ISODate | null | undefined, today?: ISODate): string {
  if (!iso) return '—';
  const d = parts(iso);
  const sameYear = today ? today.slice(0, 4) === iso.slice(0, 4) : false;
  return (sameYear ? shortDate : shortDateYear).format(d).replace(/\./g, '');
}

export function formatLongDate(iso: ISODate): string {
  const s = longDate.format(parts(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDateTime(iso: ISODateTime): string {
  return dateTime.format(new Date(iso)).replace(/\./g, '');
}

export function formatCredits(n: number): string {
  return n === 1 ? '1 crédito' : `${n} créditos`;
}

/** Oculta parcialmente un usuario: "ana.sala" → "an••••la"; en correos solo la parte local. */
export function maskUsername(value: string): string {
  const [local, domain] = value.includes('@') ? (value.split('@') as [string, string]) : [value, ''];
  const masked =
    local.length <= 3
      ? `${local.charAt(0)}••`
      : `${local.slice(0, 2)}${'•'.repeat(Math.min(6, Math.max(2, local.length - 4)))}${local.slice(-2)}`;
  return domain ? `${masked}@${domain}` : masked;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

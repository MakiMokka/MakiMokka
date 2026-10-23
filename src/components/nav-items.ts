import type { Dictionary } from '@/lib/i18n/dictionaries';

export const NAV_ITEMS = [
  { href: '/inbox', labelKey: 'inbox', icon: 'inbox' },
  { href: '/search', labelKey: 'search', icon: 'search' },
  { href: '/actions', labelKey: 'actions', icon: 'actions' },
  { href: '/follow-ups', labelKey: 'followUps', icon: 'followUps' },
  { href: '/settings', labelKey: 'settings', icon: 'settings' },
] as const satisfies readonly {
  href: string;
  labelKey: keyof Dictionary['nav'];
  icon: string;
}[];

export type NavIcon = (typeof NAV_ITEMS)[number]['icon'];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ChecklistIcon, ClockArrowIcon, GearIcon, InboxIcon, SearchIcon } from './icons';
import { NAV_ITEMS, isActivePath, type NavIcon } from './nav-items';

const ICONS: Record<NavIcon, typeof InboxIcon> = {
  inbox: InboxIcon,
  search: SearchIcon,
  actions: ChecklistIcon,
  followUps: ClockArrowIcon,
  settings: GearIcon,
};

interface AppNavProps {
  labels: Record<(typeof NAV_ITEMS)[number]['labelKey'], string>;
  ariaLabel: string;
  variant: 'sidebar' | 'tabbar';
}

/** Same destinations rendered as an iOS tab bar (mobile) or a sidebar list (desktop). */
export function AppNav({ labels, ariaLabel, variant }: AppNavProps) {
  const pathname = usePathname();

  if (variant === 'tabbar') {
    return (
      <nav
        aria-label={ariaLabel}
        className="surface-control border-line pb-safe pl-safe pr-safe fixed inset-x-0 bottom-0 z-30 border-t-[0.5px] md:hidden"
      >
        <ul className="flex h-14 items-stretch justify-around">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`text-caption flex h-full flex-col items-center justify-center gap-1 font-medium ${
                    active ? 'text-accent' : 'text-fg-muted'
                  }`}
                >
                  <Icon className="size-6" />
                  <span>{labels[item.labelKey]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label={ariaLabel}>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`text-callout rounded-control flex min-h-11 items-center gap-3 px-3 ${
                  active ? 'bg-accent-soft text-accent font-semibold' : 'text-fg hover:bg-surface-2'
                }`}
              >
                <Icon className="text-accent size-5" />
                <span>{labels[item.labelKey]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

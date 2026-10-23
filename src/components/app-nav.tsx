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
        className="border-separator bg-bar pb-safe pl-safe pr-safe fixed inset-x-0 bottom-0 z-30 border-t-[0.5px] backdrop-blur-xl backdrop-saturate-150 md:hidden"
      >
        <ul className="flex h-[49px] items-stretch justify-around">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                    active ? 'text-tint' : 'text-secondary-label'
                  }`}
                >
                  <Icon className="size-[26px]" />
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
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] ${
                  active ? 'bg-tint font-semibold text-white' : 'text-label hover:bg-fill'
                }`}
              >
                <Icon className={`size-[22px] ${active ? 'text-white' : 'text-tint'}`} />
                <span>{labels[item.labelKey]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

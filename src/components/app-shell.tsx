import type { ReactNode } from 'react';

import type { Dictionary } from '@/lib/i18n/dictionaries';

import { AppNav } from './app-nav';
import { Brand } from './brand';

/**
 * Responsive shell: bottom tab bar on phones, sidebar from the md breakpoint.
 * Safe-area insets are respected on all edges for standalone (home screen) use.
 */
export function AppShell({ t, children }: { t: Dictionary; children: ReactNode }) {
  const labels = {
    inbox: t.nav.inbox,
    search: t.nav.search,
    actions: t.nav.actions,
    followUps: t.nav.followUps,
    settings: t.nav.settings,
  };
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="bg-accent-strong text-on-accent rounded-control sr-only z-50 px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t.app.skipToContent}
      </a>
      <aside className="border-line surface-reading pt-safe pl-safe hidden w-64 shrink-0 border-r-[0.5px] md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <div className="px-5 pt-8 pb-6">
          <Brand versionTemplate={t.app.version} />
        </div>
        <div className="px-3">
          <AppNav variant="sidebar" labels={labels} ariaLabel={t.nav.label} />
        </div>
      </aside>
      <main id="main" className="pb-tabbar min-w-0 flex-1 md:pb-10">
        {children}
      </main>
      <AppNav variant="tabbar" labels={labels} ariaLabel={t.nav.label} />
    </div>
  );
}

// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Brand } from '@/components/brand';
import { EmptyState } from '@/components/empty-state';
import { isActivePath, NAV_ITEMS } from '@/components/nav-items';
import manifest from '@/app/manifest';
import { APP_VERSION } from '@/lib/version';

vi.mock('next/navigation', () => ({ usePathname: () => '/settings/accounts' }));

afterEach(cleanup);

describe('Brand', () => {
  it('shows the version directly beneath the product name', () => {
    render(<Brand name="Unified Mail" versionTemplate="Version {version}" />);
    const name = screen.getByText('Unified Mail');
    const version = screen.getByTestId('app-version');
    expect(version.textContent).toBe(`Version ${APP_VERSION}`);
    expect(name.nextElementSibling).toBe(version);
  });
});

describe('EmptyState', () => {
  it('is announced as a status with a heading and explanation', () => {
    render(
      <EmptyState icon={null} title="No accounts connected" body="Nothing is synced." testId="x" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'No accounts connected' })).toBeTruthy();
  });
});

describe('navigation', () => {
  it('has the five primary destinations', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      '/inbox',
      '/search',
      '/actions',
      '/follow-ups',
      '/settings',
    ]);
  });

  it('marks nested routes active', async () => {
    expect(isActivePath('/settings/accounts', '/settings')).toBe(true);
    expect(isActivePath('/settingsx', '/settings')).toBe(false);
    const { AppNav } = await import('@/components/app-nav');
    render(
      <AppNav
        variant="tabbar"
        ariaLabel="Main"
        labels={{
          inbox: 'Inbox',
          search: 'Search',
          actions: 'Actions',
          followUps: 'Follow-ups',
          settings: 'Settings',
        }}
      />,
    );
    const current = screen.getByRole('link', { current: 'page' });
    expect(current.textContent).toBe('Settings');
  });
});

describe('PWA manifest', () => {
  it('is installable standalone with any + maskable icons', () => {
    const m = manifest();
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/inbox');
    const sizes = (m.icons ?? []).map((icon) => `${icon.sizes}:${icon.purpose}`);
    expect(sizes).toEqual(
      expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']),
    );
  });
});

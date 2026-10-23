import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { requireAuthorizedUser } from '@/lib/auth/session';
import { getI18n } from '@/lib/i18n/server';

/** Every route in this group requires an authenticated, allowlisted user. */
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  await requireAuthorizedUser();
  const { t } = await getI18n();
  return <AppShell t={t}>{children}</AppShell>;
}

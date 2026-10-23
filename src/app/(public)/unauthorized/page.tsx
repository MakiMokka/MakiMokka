import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { LockIcon } from '@/components/icons';
import { signOutAction } from '@/lib/actions/auth';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Not authorized' };

export default async function UnauthorizedPage() {
  const { t } = await getI18n();
  return (
    <main className="pt-safe pb-safe flex min-h-dvh items-center justify-center">
      <EmptyState
        testId="unauthorized"
        icon={<LockIcon />}
        title={t.unauthorized.title}
        body={t.unauthorized.body}
        action={
          <form action={signOutAction}>
            <button type="submit" className="text-tint min-h-11 text-[17px]">
              {t.unauthorized.signOut}
            </button>
          </form>
        }
      />
    </main>
  );
}

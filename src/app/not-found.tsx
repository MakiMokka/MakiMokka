import Link from 'next/link';

import { EmptyState } from '@/components/empty-state';
import { WarningIcon } from '@/components/icons';
import { getI18n } from '@/lib/i18n/server';
import { ui } from '@/components/styles';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="pt-safe flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={<WarningIcon />}
        title={t.errors.notFoundTitle}
        body={t.errors.notFoundBody}
        action={
          <Link href="/inbox" className={ui.link}>
            {t.errors.home}
          </Link>
        }
      />
    </main>
  );
}

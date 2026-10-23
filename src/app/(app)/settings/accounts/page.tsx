import type { Metadata } from 'next';

import { EmptyState, ErrorState } from '@/components/empty-state';
import { GroupedList, ListRow } from '@/components/grouped-list';
import { EnvelopeIcon, WarningIcon } from '@/components/icons';
import { PageBody, PageHeader } from '@/components/page-header';
import { listMailAccounts } from '@/lib/db/queries';
import { getPageContext } from '@/lib/page-context';

export const metadata: Metadata = { title: 'Mail accounts' };

/**
 * Mail account management. Lists only rows that exist in the database for
 * this user; connection buttons are visibly disabled until OAuth ships.
 */
export default async function MailAccountsPage() {
  const { auth, t } = await getPageContext();
  const accounts = await listMailAccounts(auth);

  return (
    <>
      <PageHeader title={t.accounts.title} back={{ href: '/settings', label: t.settings.title }} />
      <PageBody>
        {!accounts.ok ? (
          <ErrorState icon={<WarningIcon />} message={t.common.loadError} />
        ) : accounts.data.length === 0 ? (
          <div className="surface-reading rounded-surface">
            <EmptyState
              testId="accounts-empty"
              icon={<EnvelopeIcon />}
              title={t.accounts.emptyTitle}
              body={t.accounts.emptyBody}
            />
          </div>
        ) : (
          <GroupedList header={t.accounts.connectedHeader}>
            {accounts.data.map((account) => (
              <ListRow
                key={account.id}
                label={account.display_name || account.email_address}
                detail={`${t.accounts.provider[account.provider]} · ${t.accounts.status[account.status]}`}
              />
            ))}
          </GroupedList>
        )}
        <GroupedList
          header={t.accounts.addHeader}
          footer={
            <>
              <p>{t.accounts.connectUnavailable}</p>
              <p className="mt-1">{t.accounts.workAccountsNote}</p>
            </>
          }
        >
          <ListRow
            label={t.accounts.connectMicrosoft}
            subtitle={t.common.notAvailableYet}
            disabled
          />
          <ListRow label={t.accounts.connectGoogle} subtitle={t.common.notAvailableYet} disabled />
        </GroupedList>
      </PageBody>
    </>
  );
}

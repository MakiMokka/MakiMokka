import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, ErrorState } from '@/components/empty-state';
import { EnvelopeIcon, InboxIcon, WarningIcon } from '@/components/icons';
import { MessageList } from '@/components/message-list';
import { PageBody, PageHeader } from '@/components/page-header';
import { listMailAccounts, listRecentMessages } from '@/lib/db/queries';
import { getPageContext } from '@/lib/page-context';

export const metadata: Metadata = { title: 'Inbox' };

export default async function InboxPage() {
  const { auth, t, locale, timeZone } = await getPageContext();
  const accounts = await listMailAccounts(auth);

  let content;
  if (!accounts.ok) {
    content = <ErrorState icon={<WarningIcon />} message={t.common.loadError} />;
  } else if (accounts.data.length === 0) {
    content = (
      <EmptyState
        testId="inbox-no-accounts"
        icon={<EnvelopeIcon />}
        title={t.inbox.noAccountsTitle}
        body={t.inbox.noAccountsBody}
        action={
          <Link href="/settings/accounts" className="text-tint text-[17px]">
            {t.inbox.goToAccounts}
          </Link>
        }
      />
    );
  } else {
    const messages = await listRecentMessages(auth);
    if (!messages.ok) content = <ErrorState icon={<WarningIcon />} message={t.common.loadError} />;
    else if (messages.data.length === 0)
      content = (
        <EmptyState
          testId="inbox-empty"
          icon={<InboxIcon />}
          title={t.inbox.emptyTitle}
          body={t.inbox.emptyBody}
        />
      );
    else
      content = (
        <MessageList messages={messages.data} t={t.inbox} locale={locale} timeZone={timeZone} />
      );
  }

  return (
    <>
      <PageHeader title={t.inbox.title} />
      <PageBody>{content}</PageBody>
    </>
  );
}

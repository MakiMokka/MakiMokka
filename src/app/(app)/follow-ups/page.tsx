import type { Metadata } from 'next';

import { EmptyState, ErrorState } from '@/components/empty-state';
import { GroupedList, ListRow } from '@/components/grouped-list';
import { ClockArrowIcon, WarningIcon } from '@/components/icons';
import { PageBody, PageHeader } from '@/components/page-header';
import { listOpenFollowUps } from '@/lib/db/queries';
import { interpolate } from '@/lib/i18n/config';
import { formatDateTime } from '@/lib/i18n/format';
import { getPageContext } from '@/lib/page-context';

export const metadata: Metadata = { title: 'Follow-ups' };

export default async function FollowUpsPage() {
  const { auth, t, locale, timeZone } = await getPageContext();
  const followUps = await listOpenFollowUps(auth);

  let content;
  if (!followUps.ok) content = <ErrorState icon={<WarningIcon />} message={t.common.loadError} />;
  else if (followUps.data.length === 0)
    content = (
      <EmptyState
        testId="follow-ups-empty"
        icon={<ClockArrowIcon />}
        title={t.followUps.emptyTitle}
        body={t.followUps.emptyBody}
      />
    );
  else
    content = (
      <GroupedList>
        {followUps.data.map((item) => (
          <ListRow
            key={item.id}
            label={item.title}
            detail={interpolate(t.followUps.due, {
              date: formatDateTime(item.due_at, locale, timeZone),
            })}
          />
        ))}
      </GroupedList>
    );

  return (
    <>
      <PageHeader title={t.followUps.title} />
      <PageBody>{content}</PageBody>
    </>
  );
}

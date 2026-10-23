import type { Metadata } from 'next';

import { EmptyState, ErrorState } from '@/components/empty-state';
import { GroupedList, ListRow } from '@/components/grouped-list';
import { ChecklistIcon, WarningIcon } from '@/components/icons';
import { PageBody, PageHeader } from '@/components/page-header';
import { listOpenTasks } from '@/lib/db/queries';
import { interpolate } from '@/lib/i18n/config';
import { formatDateTime } from '@/lib/i18n/format';
import { getPageContext } from '@/lib/page-context';

export const metadata: Metadata = { title: 'Actions' };

export default async function ActionsPage() {
  const { auth, t, locale, timeZone } = await getPageContext();
  const tasks = await listOpenTasks(auth);

  let content;
  if (!tasks.ok) content = <ErrorState icon={<WarningIcon />} message={t.common.loadError} />;
  else if (tasks.data.length === 0)
    content = (
      <EmptyState
        testId="actions-empty"
        icon={<ChecklistIcon />}
        title={t.actions.emptyTitle}
        body={t.actions.emptyBody}
      />
    );
  else
    content = (
      <GroupedList>
        {tasks.data.map((task) => (
          <ListRow
            key={task.id}
            label={task.title}
            detail={
              task.due_at
                ? interpolate(t.actions.due, {
                    date: formatDateTime(task.due_at, locale, timeZone),
                  })
                : undefined
            }
          />
        ))}
      </GroupedList>
    );

  return (
    <>
      <PageHeader title={t.actions.title} />
      <PageBody>{content}</PageBody>
    </>
  );
}

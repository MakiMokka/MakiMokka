import type { Metadata } from 'next';

import { GroupedList, ListRow } from '@/components/grouped-list';
import { PageBody, PageHeader } from '@/components/page-header';
import { signOutAction } from '@/lib/actions/auth';
import { listAuditEventsForUser, type AuditEventRow } from '@/lib/db/repositories/audit';
import { getWorkerSql } from '@/lib/db/worker';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { formatDateTime } from '@/lib/i18n/format';
import { logger } from '@/lib/logging/logger';
import { getPageContext } from '@/lib/page-context';
import { ui } from '@/components/styles';

export const metadata: Metadata = { title: 'Security' };

type ActivityResult =
  { status: 'ok'; events: AuditEventRow[] } | { status: 'unavailable' } | { status: 'error' };

async function loadActivity(userId: string): Promise<ActivityResult> {
  const sql = getWorkerSql();
  if (!sql) return { status: 'unavailable' };
  try {
    // Scoped to the authorized caller's id from the auth context.
    return { status: 'ok', events: await listAuditEventsForUser(sql, userId, 20) };
  } catch (error) {
    logger.error('security.activity_load_failed', { error });
    return { status: 'error' };
  }
}

function eventLabel(t: Dictionary['security'], type: string): string {
  return (t.events as Record<string, string>)[type] ?? type;
}

export default async function SecurityPage() {
  const { auth, t, locale, timeZone } = await getPageContext();
  const activity = await loadActivity(auth.userId);

  return (
    <>
      <PageHeader title={t.security.title} back={{ href: '/settings', label: t.settings.title }} />
      <PageBody>
        <GroupedList header={t.security.sessionHeader}>
          <ListRow label={t.security.signedInAs} detail={auth.email ?? '—'} />
        </GroupedList>
        <section className="space-y-3">
          <form action={signOutAction}>
            <input type="hidden" name="scope" value="local" />
            <button type="submit" className={ui.buttonDestructive}>
              {t.security.signOut}
            </button>
          </form>
          <form action={signOutAction}>
            <input type="hidden" name="scope" value="global" />
            <button type="submit" className={ui.buttonDestructive}>
              {t.security.signOutEverywhere}
            </button>
          </form>
        </section>
        <GroupedList header={t.security.activityHeader}>
          {activity.status === 'unavailable' ? (
            <ListRow
              wrap
              label={
                <span className="text-fg-muted text-callout">{t.security.activityUnavailable}</span>
              }
            />
          ) : activity.status === 'error' ? (
            <ListRow
              label={<span className="text-fg-muted text-callout">{t.common.loadError}</span>}
            />
          ) : activity.events.length === 0 ? (
            <ListRow
              label={<span className="text-fg-muted text-callout">{t.security.activityEmpty}</span>}
            />
          ) : (
            activity.events.map((event) => (
              <ListRow
                key={event.id}
                label={eventLabel(t.security, event.eventType)}
                detail={formatDateTime(event.occurredAt, locale, timeZone)}
              />
            ))
          )}
        </GroupedList>
      </PageBody>
    </>
  );
}

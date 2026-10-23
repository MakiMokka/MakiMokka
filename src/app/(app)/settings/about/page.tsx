import type { Metadata } from 'next';

import { Brand } from '@/components/brand';
import { GroupedList, ListRow } from '@/components/grouped-list';
import { PageBody, PageHeader } from '@/components/page-header';
import { getPageContext } from '@/lib/page-context';
import { APP_COMMIT, APP_VERSION } from '@/lib/version';

export const metadata: Metadata = { title: 'About' };

export default async function AboutPage() {
  const { t } = await getPageContext();
  return (
    <>
      <PageHeader title={t.about.title} back={{ href: '/settings', label: t.settings.title }} />
      <PageBody>
        <div className="py-2">
          <Brand versionTemplate={t.app.version} size="lg" />
        </div>
        <GroupedList>
          <ListRow label={t.about.version} detail={APP_VERSION} />
          {APP_COMMIT ? <ListRow label={t.about.build} detail={APP_COMMIT} /> : null}
        </GroupedList>
        <GroupedList header={t.about.privacyHeader}>
          <ListRow wrap label={<span className="text-callout">{t.about.privacyBodies}</span>} />
          <ListRow
            wrap
            label={<span className="text-callout">{t.about.privacyCredentials}</span>}
          />
          <ListRow wrap label={<span className="text-callout">{t.about.privacyAi}</span>} />
        </GroupedList>
      </PageBody>
    </>
  );
}

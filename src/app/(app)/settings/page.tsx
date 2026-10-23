import type { Metadata } from 'next';

import { Brand } from '@/components/brand';
import { GroupedList, IconBadge, ListRow } from '@/components/grouped-list';
import { EnvelopeIcon, InfoIcon, LockIcon, PersonIcon } from '@/components/icons';
import { PageBody, PageHeader } from '@/components/page-header';
import { getPageContext } from '@/lib/page-context';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { auth, t, locale } = await getPageContext();
  return (
    <>
      <PageHeader title={t.settings.title} />
      <PageBody>
        <div className="surface-reading rounded-surface identity-aura overflow-hidden px-5 py-5">
          <Brand versionTemplate={t.app.version} />
          {auth.email ? (
            <p className="text-fg-muted text-subhead mt-3 truncate">{auth.email}</p>
          ) : null}
        </div>
        <GroupedList header={t.settings.sectionAccount}>
          <ListRow
            href="/settings/profile"
            label={t.settings.profile}
            leading={
              <IconBadge>
                <PersonIcon />
              </IconBadge>
            }
          />
          <ListRow
            href="/settings/accounts"
            label={t.settings.mailAccounts}
            leading={
              <IconBadge>
                <EnvelopeIcon />
              </IconBadge>
            }
          />
          <ListRow
            href="/settings/security"
            label={t.settings.security}
            leading={
              <IconBadge>
                <LockIcon />
              </IconBadge>
            }
          />
        </GroupedList>
        <GroupedList header={t.settings.sectionPreferences}>
          <ListRow
            href="/settings/language"
            label={t.settings.language}
            detail={locale === 'es' ? t.language.spanish : t.language.english}
            leading={
              <IconBadge>
                <span className="text-subhead font-display font-bold">Aa</span>
              </IconBadge>
            }
          />
        </GroupedList>
        <GroupedList header={t.settings.sectionInformation}>
          <ListRow
            href="/settings/about"
            label={t.settings.about}
            leading={
              <IconBadge>
                <InfoIcon />
              </IconBadge>
            }
          />
        </GroupedList>
      </PageBody>
    </>
  );
}

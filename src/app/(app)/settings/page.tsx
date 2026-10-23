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
        <div className="bg-cell flex items-center gap-4 rounded-[10px] px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- static same-origin icon */}
          <img src="/icons/icon-192.png" alt="" width={56} height={56} className="rounded-[13px]" />
          <div className="min-w-0">
            <Brand name={t.app.name} versionTemplate={t.app.version} />
            {auth.email ? (
              <p className="text-secondary-label truncate text-[13px]">{auth.email}</p>
            ) : null}
          </div>
        </div>
        <GroupedList header={t.settings.sectionAccount}>
          <ListRow
            href="/settings/profile"
            label={t.settings.profile}
            leading={
              <IconBadge color="bg-[#8e8e93]">
                <PersonIcon />
              </IconBadge>
            }
          />
          <ListRow
            href="/settings/accounts"
            label={t.settings.mailAccounts}
            leading={
              <IconBadge color="bg-[#007aff]">
                <EnvelopeIcon />
              </IconBadge>
            }
          />
          <ListRow
            href="/settings/security"
            label={t.settings.security}
            leading={
              <IconBadge color="bg-[#34c759]">
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
              <IconBadge color="bg-[#5856d6]">
                <span className="text-[13px] font-bold">Aa</span>
              </IconBadge>
            }
          />
        </GroupedList>
        <GroupedList header={t.settings.sectionInformation}>
          <ListRow
            href="/settings/about"
            label={t.settings.about}
            leading={
              <IconBadge color="bg-[#8e8e93]">
                <InfoIcon />
              </IconBadge>
            }
          />
        </GroupedList>
      </PageBody>
    </>
  );
}

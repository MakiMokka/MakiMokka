import type { Metadata } from 'next';

import { ErrorState } from '@/components/empty-state';
import { WarningIcon } from '@/components/icons';
import { PageBody, PageHeader } from '@/components/page-header';
import { getPageContext } from '@/lib/page-context';

import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const { t, profile } = await getPageContext();
  return (
    <>
      <PageHeader title={t.profile.title} back={{ href: '/settings', label: t.settings.title }} />
      <PageBody>
        {profile.ok && profile.data ? (
          <ProfileForm
            t={t.profile}
            common={t.common}
            displayName={profile.data.display_name ?? ''}
            timeZone={profile.data.time_zone}
          />
        ) : (
          <ErrorState icon={<WarningIcon />} message={t.common.loadError} />
        )}
      </PageBody>
    </>
  );
}

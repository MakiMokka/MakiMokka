import { interpolate } from '@/lib/i18n/config';
import { APP_VERSION } from '@/lib/version';

import { Wordmark } from './wordmark';

/** Product wordmark with the version number directly beneath it. */
export function Brand({
  versionTemplate,
  size = 'md',
}: {
  versionTemplate: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div className={size === 'lg' ? 'flex flex-col items-center text-center' : 'flex flex-col'}>
      <Wordmark size={size === 'lg' ? 'lg' : 'md'} />
      <p className="text-fg-muted text-caption mt-1" data-testid="app-version">
        {interpolate(versionTemplate, { version: APP_VERSION })}
      </p>
    </div>
  );
}

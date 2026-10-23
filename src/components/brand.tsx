import { interpolate } from '@/lib/i18n/config';
import { APP_VERSION } from '@/lib/version';

/** Product name with the version number directly beneath it. */
export function Brand({
  name,
  versionTemplate,
  size = 'md',
}: {
  name: string;
  versionTemplate: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div className={size === 'lg' ? 'text-center' : undefined}>
      <p
        className={
          size === 'lg' ? 'text-[28px] font-bold tracking-tight' : 'text-[17px] font-semibold'
        }
      >
        {name}
      </p>
      <p className="text-secondary-label text-[13px]" data-testid="app-version">
        {interpolate(versionTemplate, { version: APP_VERSION })}
      </p>
    </div>
  );
}

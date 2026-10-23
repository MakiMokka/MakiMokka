import Link from 'next/link';
import type { ReactNode } from 'react';

import { ChevronRightIcon } from './icons';

/** iOS inset grouped table section. */
export function GroupedList({
  header,
  footer,
  children,
}: {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      {header ? (
        <h2 className="text-fg-muted text-caption px-4 pb-2 font-semibold tracking-[0.06em] uppercase">
          {header}
        </h2>
      ) : null}
      <ul className="surface-reading rounded-container [&>li+li]:border-line overflow-hidden [&>li+li]:border-t-[0.5px]">
        {children}
      </ul>
      {footer ? <div className="text-fg-muted text-subhead px-4 pt-2">{footer}</div> : null}
    </section>
  );
}

interface RowProps {
  label: ReactNode;
  /** Secondary line under the label (wraps instead of truncating). */
  subtitle?: ReactNode;
  /** Let a long label wrap instead of truncating. */
  wrap?: boolean;
  detail?: ReactNode;
  leading?: ReactNode;
  href?: string;
  disabled?: boolean;
  trailing?: ReactNode;
}

export function ListRow({
  label,
  subtitle,
  wrap,
  detail,
  leading,
  href,
  disabled,
  trailing,
}: RowProps) {
  const content = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      {subtitle ? (
        <span className="min-w-0 flex-1">
          <span className="block">{label}</span>
          <span className="text-fg-muted text-subhead block">{subtitle}</span>
        </span>
      ) : (
        <span className={`min-w-0 flex-1 ${wrap ? '' : 'truncate'}`}>{label}</span>
      )}
      {detail ? <span className="text-fg-muted text-callout truncate">{detail}</span> : null}
      {trailing}
      {href && !disabled ? <ChevronRightIcon className="text-fg-subtle size-4 shrink-0" /> : null}
    </>
  );
  const className = `text-body flex min-h-12 items-center gap-3 px-4 py-3 ${disabled ? 'text-fg-subtle' : 'text-fg'}`;
  return (
    <li>
      {href && !disabled ? (
        <Link href={href} className={`${className} active:bg-surface-2 hover:bg-surface-2`}>
          {content}
        </Link>
      ) : (
        <div className={className} aria-disabled={disabled || undefined}>
          {content}
        </div>
      )}
    </li>
  );
}

/** Leading glyph tile for settings rows: one restrained accent tone, not a rainbow. */
export function IconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="bg-accent-soft text-accent rounded-inner flex size-8 items-center justify-center [&>svg]:size-[18px]">
      {children}
    </span>
  );
}

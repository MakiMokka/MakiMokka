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
        <h2 className="text-secondary-label px-4 pb-1.5 text-[13px] uppercase">{header}</h2>
      ) : null}
      <ul className="bg-cell divide-separator [&>li+li]:border-separator overflow-hidden rounded-[10px] [&>li+li]:border-t-[0.5px]">
        {children}
      </ul>
      {footer ? <div className="text-secondary-label px-4 pt-1.5 text-[13px]">{footer}</div> : null}
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
          <span className="text-secondary-label block text-[13px]">{subtitle}</span>
        </span>
      ) : (
        <span className={`min-w-0 flex-1 ${wrap ? '' : 'truncate'}`}>{label}</span>
      )}
      {detail ? <span className="text-secondary-label truncate text-[15px]">{detail}</span> : null}
      {trailing}
      {href && !disabled ? (
        <ChevronRightIcon className="text-tertiary-label size-4 shrink-0" />
      ) : null}
    </>
  );
  const className = `flex min-h-11 items-center gap-3 px-4 py-2.5 text-[17px] ${disabled ? 'text-tertiary-label' : ''}`;
  return (
    <li>
      {href && !disabled ? (
        <Link href={href} className={`${className} active:bg-fill`}>
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

export function IconBadge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className={`flex size-[29px] items-center justify-center rounded-[7px] text-white ${color} [&>svg]:size-[18px]`}
    >
      {children}
    </span>
  );
}

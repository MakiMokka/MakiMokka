import Link from 'next/link';
import type { ReactNode } from 'react';

import { ChevronLeftIcon } from './icons';

/** iOS-style large title header. Sub-pages get a back link instead. */
export function PageHeader({
  title,
  back,
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <header className="pt-safe px-gutter mx-auto w-full max-w-3xl md:px-8">
      {back ? (
        <Link
          href={back.href}
          className="text-accent text-body -ml-1 inline-flex min-h-11 items-center gap-1 pt-1"
        >
          <ChevronLeftIcon className="size-5" />
          {back.label}
        </Link>
      ) : (
        <div className="h-11" />
      )}
      <h1 className="text-display text-fg pb-3 font-bold">{title}</h1>
      {children}
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="px-gutter mx-auto w-full max-w-3xl space-y-8 pt-2 md:px-8">{children}</div>
  );
}

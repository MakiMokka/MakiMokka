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
    <header className="pt-safe px-safe mx-auto w-full max-w-3xl md:px-8">
      {back ? (
        <Link
          href={back.href}
          className="text-tint -ml-1 inline-flex min-h-11 items-center gap-0.5 pt-1 text-[17px]"
        >
          <ChevronLeftIcon className="size-[22px]" />
          {back.label}
        </Link>
      ) : (
        <div className="h-11" />
      )}
      <h1 className="pb-2 text-[34px] leading-tight font-bold tracking-tight">{title}</h1>
      {children}
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="px-safe mx-auto w-full max-w-3xl space-y-8 pt-2 md:px-8">{children}</div>;
}

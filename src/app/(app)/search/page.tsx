import type { Metadata } from 'next';

import { EmptyState, ErrorState } from '@/components/empty-state';
import { SearchIcon, WarningIcon } from '@/components/icons';
import { MessageList } from '@/components/message-list';
import { PageBody, PageHeader } from '@/components/page-header';
import { listMailAccounts, searchMessages } from '@/lib/db/queries';
import { interpolate } from '@/lib/i18n/config';
import { getPageContext } from '@/lib/page-context';

export const metadata: Metadata = { title: 'Search' };

const MAX_QUERY = 200;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [{ auth, t, locale, timeZone }, params] = await Promise.all([
    getPageContext(),
    searchParams,
  ]);
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (raw ?? '').trim();
  const tooLong = query.length > MAX_QUERY;
  const accounts = await listMailAccounts(auth);
  const hasAccounts = accounts.ok && accounts.data.length > 0;

  let content;
  if (!accounts.ok) {
    content = <ErrorState icon={<WarningIcon />} message={t.common.loadError} />;
  } else if (!hasAccounts) {
    content = (
      <EmptyState
        testId="search-no-accounts"
        icon={<SearchIcon />}
        title={t.search.noAccountsTitle}
        body={t.search.noAccountsBody}
      />
    );
  } else if (tooLong) {
    content = <ErrorState icon={<WarningIcon />} message={t.search.queryTooLong} />;
  } else if (!query) {
    content = (
      <EmptyState icon={<SearchIcon />} title={t.search.promptTitle} body={t.search.promptBody} />
    );
  } else {
    const results = await searchMessages(auth, query);
    if (!results.ok) content = <ErrorState icon={<WarningIcon />} message={t.common.loadError} />;
    else if (results.data.length === 0)
      content = (
        <EmptyState
          icon={<SearchIcon />}
          title={t.search.noResultsTitle}
          body={interpolate(t.search.noResultsBody, { query })}
        />
      );
    else
      content = (
        <MessageList messages={results.data} t={t.inbox} locale={locale} timeZone={timeZone} />
      );
  }

  return (
    <>
      <PageHeader title={t.search.title}>
        <form role="search" action="/search" method="get" className="pb-2">
          <label className="bg-surface-2 rounded-control flex min-h-11 items-center gap-2 px-3">
            <SearchIcon className="text-fg-muted size-5 shrink-0" />
            <span className="sr-only">{t.search.placeholder}</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              maxLength={MAX_QUERY}
              placeholder={t.search.placeholder}
              enterKeyHint="search"
              autoComplete="off"
              disabled={!hasAccounts}
              className="placeholder:text-fg-muted text-fg min-w-0 flex-1 bg-transparent py-2 outline-none disabled:opacity-60"
            />
          </label>
        </form>
      </PageHeader>
      <PageBody>{content}</PageBody>
    </>
  );
}

import type { MessageListItem } from '@/lib/db/queries';
import type { AppLocale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { formatDateTime } from '@/lib/i18n/format';

/** Metadata-only message rows (subject, sender, date). No bodies exist to show. */
export function MessageList({
  messages,
  t,
  locale,
  timeZone,
}: {
  messages: MessageListItem[];
  t: Dictionary['inbox'];
  locale: AppLocale;
  timeZone: string;
}) {
  return (
    <ul className="surface-reading rounded-container [&>li+li]:border-line overflow-hidden [&>li+li]:border-t-[0.5px]">
      {messages.map((message) => (
        <li key={message.id} className="flex gap-3 px-4 py-3">
          <span
            className={`mt-2 size-2.5 shrink-0 rounded-full ${message.is_read ? '' : 'bg-accent'}`}
            aria-label={message.is_read ? undefined : t.unread}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-body text-fg min-w-0 flex-1 truncate font-semibold">
                {message.sender_name || message.sender_address || t.unknownSender}
              </p>
              <time
                className="text-fg-muted text-subhead shrink-0"
                dateTime={message.received_at ?? undefined}
              >
                {formatDateTime(message.received_at, locale, timeZone)}
              </time>
            </div>
            <p className="text-callout text-fg-muted truncate">{message.subject || t.noSubject}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

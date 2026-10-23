import { describe, expect, it } from 'vitest';

import { TABLE_COLUMNS, selectList } from '@/lib/db/columns';
import * as lists from '@/lib/db/queries/select-lists';
import { AUDIT_EVENT_TYPES, sanitizeAuditMetadata } from '@/lib/db/repositories/audit';
import { en } from '@/lib/i18n/dictionaries/en';

const TABLE_FOR: Record<keyof typeof lists, keyof typeof TABLE_COLUMNS> = {
  PROFILE_COLUMNS: 'public.profiles',
  MAIL_ACCOUNT_COLUMNS: 'public.mail_accounts',
  MESSAGE_LIST_COLUMNS: 'public.message_metadata',
  FOLLOW_UP_COLUMNS: 'public.follow_ups',
  TASK_COLUMNS: 'public.tasks',
  SAVED_VIEW_COLUMNS: 'public.saved_views',
};

describe('select lists', () => {
  it.each(Object.entries(lists))('%s only names real columns', (name, list) => {
    const columns: readonly string[] = TABLE_COLUMNS[TABLE_FOR[name as keyof typeof lists]];
    for (const column of list.split(',')) expect(columns).toContain(column);
  });

  it('message list never selects provider ids or search internals', () => {
    expect(lists.MESSAGE_LIST_COLUMNS).not.toContain('provider_message_id');
    expect(lists.MESSAGE_LIST_COLUMNS).not.toContain('search_vector');
  });

  it('selectList omits requested columns', () => {
    expect(selectList('public.saved_views', ['definition'])).toBe(
      'id,user_id,name,position,created_at,updated_at',
    );
  });
});

describe('audit metadata', () => {
  it('keeps only allowlisted keys with safe values', () => {
    expect(
      sanitizeAuditMetadata({
        locale: 'es',
        scope: 'global',
        fields: ['display_name', 'bad value!'],
        refreshToken: 'abc',
        subject: 'Payroll',
        reason: 'ana@example.com',
        provider: 'x'.repeat(65),
      }),
    ).toEqual({ locale: 'es', scope: 'global', fields: ['display_name'] });
  });

  it('every event type has a label in the security screen', () => {
    for (const type of AUDIT_EVENT_TYPES) expect(Object.keys(en.security.events)).toContain(type);
  });
});

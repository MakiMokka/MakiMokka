import 'server-only';

import type { AuthorizedContext } from '@/lib/auth/session';
import type { Locale, Tables } from '@/lib/db/types';

import {
  FOLLOW_UP_COLUMNS,
  MAIL_ACCOUNT_COLUMNS,
  MESSAGE_LIST_COLUMNS,
  PROFILE_COLUMNS,
  SAVED_VIEW_COLUMNS,
  TASK_COLUMNS,
} from './select-lists';

/**
 * User-scoped data access. Every function takes an AuthorizedContext (which
 * can only be obtained from the authorization layer) and filters by the
 * context's user id explicitly, in addition to RLS enforcing the same rule.
 *
 * Results are a discriminated union so pages can tell "empty" from "failed"
 * and never present an error as an empty mailbox.
 */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; errorCode: string };

function fail<T>(error: { code?: string } | null): QueryResult<T> {
  return { ok: false, errorCode: error?.code ?? 'unknown' };
}

export async function getProfile(
  ctx: AuthorizedContext,
): Promise<QueryResult<Tables<'profiles'> | null>> {
  const { data, error } = await ctx.supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', ctx.userId)
    .maybeSingle();
  return error ? fail(error) : { ok: true, data };
}

export async function updateProfilePreferences(
  ctx: AuthorizedContext,
  changes: { display_name?: string | null; locale?: Locale; time_zone?: string },
): Promise<QueryResult<null>> {
  const { error } = await ctx.supabase.from('profiles').update(changes).eq('id', ctx.userId);
  return error ? fail(error) : { ok: true, data: null };
}

export async function listMailAccounts(
  ctx: AuthorizedContext,
): Promise<QueryResult<Tables<'mail_accounts'>[]>> {
  const { data, error } = await ctx.supabase
    .from('mail_accounts')
    .select(MAIL_ACCOUNT_COLUMNS)
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: true });
  return error ? fail(error) : { ok: true, data };
}

export type MessageListItem = Pick<
  Tables<'message_metadata'>,
  | 'id'
  | 'account_id'
  | 'provider_thread_id'
  | 'subject'
  | 'sender_name'
  | 'sender_address'
  | 'received_at'
  | 'is_read'
  | 'is_flagged'
  | 'importance'
  | 'has_attachments'
>;

export async function listRecentMessages(
  ctx: AuthorizedContext,
  limit = 50,
): Promise<QueryResult<MessageListItem[]>> {
  const { data, error } = await ctx.supabase
    .from('message_metadata')
    .select(MESSAGE_LIST_COLUMNS)
    .eq('user_id', ctx.userId)
    .order('received_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  return error ? fail(error) : { ok: true, data };
}

export async function searchMessages(
  ctx: AuthorizedContext,
  query: string,
  limit = 50,
): Promise<QueryResult<MessageListItem[]>> {
  const { data, error } = await ctx.supabase
    .from('message_metadata')
    .select(MESSAGE_LIST_COLUMNS)
    .eq('user_id', ctx.userId)
    .textSearch('search_vector', query, { type: 'websearch', config: 'simple' })
    .order('received_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  return error ? fail(error) : { ok: true, data };
}

export async function listOpenFollowUps(
  ctx: AuthorizedContext,
): Promise<QueryResult<Tables<'follow_ups'>[]>> {
  const { data, error } = await ctx.supabase
    .from('follow_ups')
    .select(FOLLOW_UP_COLUMNS)
    .eq('user_id', ctx.userId)
    .eq('status', 'open')
    .order('due_at', { ascending: true })
    .limit(200);
  return error ? fail(error) : { ok: true, data };
}

export async function listOpenTasks(
  ctx: AuthorizedContext,
): Promise<QueryResult<Tables<'tasks'>[]>> {
  const { data, error } = await ctx.supabase
    .from('tasks')
    .select(TASK_COLUMNS)
    .eq('user_id', ctx.userId)
    .eq('status', 'open')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(200);
  return error ? fail(error) : { ok: true, data };
}

export async function listSavedViews(
  ctx: AuthorizedContext,
): Promise<QueryResult<Tables<'saved_views'>[]>> {
  const { data, error } = await ctx.supabase
    .from('saved_views')
    .select(SAVED_VIEW_COLUMNS)
    .eq('user_id', ctx.userId)
    .order('position', { ascending: true });
  return error ? fail(error) : { ok: true, data };
}

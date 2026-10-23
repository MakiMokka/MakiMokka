import 'server-only';

import { ApiError } from '@/lib/api/errors';
import type { Tables } from '@/lib/db/types';
import { MAIL_ACCOUNT_COLUMNS } from '@/lib/db/queries/select-lists';
import { isUuid } from '@/lib/validation';

import type { AuthorizedContext } from './session';

/**
 * Validate that `accountId` belongs to the authorized caller. Call this at
 * the top of every request handler that receives an account id.
 *
 * Responds 404 (not 403) for accounts the caller does not own so that the
 * existence of other users' accounts is not revealed.
 */
export async function requireOwnedMailAccount(
  ctx: AuthorizedContext,
  accountId: unknown,
): Promise<Tables<'mail_accounts'>> {
  if (!isUuid(accountId)) throw new ApiError('not_found');
  const { data, error } = await ctx.supabase
    .from('mail_accounts')
    .select(MAIL_ACCOUNT_COLUMNS)
    .eq('id', accountId)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (error) throw new ApiError('internal_error');
  if (!data || data.user_id !== ctx.userId) throw new ApiError('not_found');
  return data;
}

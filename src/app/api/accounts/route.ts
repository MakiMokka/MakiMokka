import { ApiError } from '@/lib/api/errors';
import { jsonResponse, methodNotAllowed, withApiHandler } from '@/lib/api/response';
import { requireAuthorizedApiUser } from '@/lib/auth/session';
import { listMailAccounts } from '@/lib/db/queries';

import { toPublicAccount } from './serialize';

/** List the caller's mail accounts. */
export const GET = withApiHandler(async () => {
  const ctx = await requireAuthorizedApiUser();
  const result = await listMailAccounts(ctx);
  if (!result.ok) throw new ApiError('internal_error');
  return jsonResponse({ accounts: result.data.map(toPublicAccount) });
});

/** Connecting accounts requires the OAuth flow (later phase). */
export const POST = withApiHandler(async () => {
  await requireAuthorizedApiUser();
  throw new ApiError('not_implemented');
});

export const PUT = methodNotAllowed(['GET', 'POST']);
export const PATCH = methodNotAllowed(['GET', 'POST']);
export const DELETE = methodNotAllowed(['GET', 'POST']);

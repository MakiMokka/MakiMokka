import { ApiError } from '@/lib/api/errors';
import { jsonResponse, methodNotAllowed, withApiHandler } from '@/lib/api/response';
import { requireOwnedMailAccount } from '@/lib/auth/authorize';
import { requireAuthorizedApiUser } from '@/lib/auth/session';

import { toPublicAccount } from '../serialize';

type Context = { params: Promise<{ accountId: string }> };

/** Read one account. Ownership is validated before anything else happens. */
export const GET = withApiHandler<Context>(async (_request, { params }) => {
  const ctx = await requireAuthorizedApiUser();
  const { accountId } = await params;
  const account = await requireOwnedMailAccount(ctx, accountId);
  return jsonResponse({ account: toPublicAccount(account) });
});

/** Disconnecting requires provider token revocation (later phase). */
export const DELETE = withApiHandler<Context>(async (_request, { params }) => {
  const ctx = await requireAuthorizedApiUser();
  const { accountId } = await params;
  await requireOwnedMailAccount(ctx, accountId);
  throw new ApiError('not_implemented');
});

export const POST = methodNotAllowed(['GET', 'DELETE']);
export const PUT = methodNotAllowed(['GET', 'DELETE']);
export const PATCH = methodNotAllowed(['GET', 'DELETE']);

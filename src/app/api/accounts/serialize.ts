import type { Tables } from '@/lib/db/types';

/** Explicit response shape: internal columns (user_id, provider ids) are not returned. */
export function toPublicAccount(account: Tables<'mail_accounts'>) {
  return {
    id: account.id,
    provider: account.provider,
    emailAddress: account.email_address,
    displayName: account.display_name,
    status: account.status,
    connectedAt: account.connected_at,
  };
}

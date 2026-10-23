import type postgres from 'postgres';

import {
  decryptCredential,
  encryptCredential,
  type CredentialBinding,
  type Keyring,
  type OAuthSecret,
} from '@/lib/crypto/credentials';

/**
 * Encrypted OAuth credential storage (app_private.oauth_credentials).
 *
 * Every query is scoped by BOTH user id and account id; the composite
 * foreign key guarantees the account belongs to that user. Plaintext tokens
 * exist only in server memory for the duration of a provider call.
 */

export async function storeCredential(
  sql: postgres.Sql,
  keyring: Keyring,
  binding: CredentialBinding,
  secret: OAuthSecret,
  details: { grantedScopes: string[]; accessTokenExpiresAt: Date | null },
): Promise<void> {
  const encrypted = encryptCredential(keyring, secret, binding);
  const result = await sql`
    insert into app_private.oauth_credentials
      (account_id, user_id, ciphertext, nonce, auth_tag, key_version, granted_scopes, access_token_expires_at)
    values (
      ${binding.accountId}, ${binding.userId}, ${encrypted.ciphertext}, ${encrypted.nonce},
      ${encrypted.authTag}, ${encrypted.keyVersion}, ${details.grantedScopes}, ${details.accessTokenExpiresAt}
    )
    on conflict (account_id) do update set
      ciphertext = excluded.ciphertext,
      nonce = excluded.nonce,
      auth_tag = excluded.auth_tag,
      key_version = excluded.key_version,
      granted_scopes = excluded.granted_scopes,
      access_token_expires_at = excluded.access_token_expires_at
    where app_private.oauth_credentials.user_id = excluded.user_id
  `;
  // The conflict guard leaves another user's row untouched; surface that as
  // an error instead of letting the caller believe the write happened.
  if (result.count !== 1) {
    throw new CredentialOwnershipError();
  }
}

export class CredentialOwnershipError extends Error {
  override name = 'CredentialOwnershipError';
  constructor() {
    super('Credential account does not belong to this user');
  }
}

export async function loadCredential(
  sql: postgres.Sql,
  keyring: Keyring,
  binding: CredentialBinding,
): Promise<OAuthSecret | null> {
  const rows = await sql<
    { ciphertext: Buffer; nonce: Buffer; auth_tag: Buffer; key_version: number }[]
  >`
    select ciphertext, nonce, auth_tag, key_version
    from app_private.oauth_credentials
    where account_id = ${binding.accountId} and user_id = ${binding.userId}
  `;
  const row = rows[0];
  if (!row) return null;
  return decryptCredential(
    keyring,
    {
      ciphertext: row.ciphertext,
      nonce: row.nonce,
      authTag: row.auth_tag,
      keyVersion: row.key_version,
    },
    binding,
  );
}

export async function deleteCredential(
  sql: postgres.Sql,
  binding: CredentialBinding,
): Promise<boolean> {
  const result = await sql`
    delete from app_private.oauth_credentials
    where account_id = ${binding.accountId} and user_id = ${binding.userId}
  `;
  return result.count > 0;
}

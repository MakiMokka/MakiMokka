import { randomBytes, randomUUID } from 'node:crypto';

import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseKeyring } from '@/lib/crypto/credentials';
import { listAuditEventsForUser, recordAuditEvent } from '@/lib/db/repositories/audit';
import {
  CredentialOwnershipError,
  deleteCredential,
  loadCredential,
  storeCredential,
} from '@/lib/db/repositories/credentials';

import { WORKER_DATABASE_URL } from './config';
import { sql as owner } from './helpers';

/**
 * Exercises the server-side repositories over a real login connection as
 * app_worker — the same path production uses via DATABASE_URL.
 */
const worker = postgres(WORKER_DATABASE_URL, { max: 2, onnotice: () => {} });
const keyring = parseKeyring(`1:${randomBytes(32).toString('base64')}`, 1);

const alice = { userId: randomUUID(), accountId: randomUUID() };
const bob = { userId: randomUUID(), accountId: randomUUID() };

beforeAll(async () => {
  for (const user of [alice, bob]) {
    await owner`insert into auth.users (id) values (${user.userId})`;
    await owner`insert into app_private.authorized_users (user_id) values (${user.userId})`;
    await owner`
      insert into public.mail_accounts (id, user_id, provider, provider_account_id, email_address)
      values (${user.accountId}, ${user.userId}, 'google', ${user.accountId}, ${`${user.userId}@example.test`})
    `;
  }
});

afterAll(async () => {
  await owner`delete from auth.users where id in ${owner([alice.userId, bob.userId])}`;
  await worker.end();
  await owner.end();
});

describe('connection as app_worker', () => {
  it('runs as the least-privilege role', async () => {
    const [row] = await worker`select current_user as role`;
    expect(row?.role).toBe('app_worker');
    await expect(worker`select * from auth.users`).rejects.toMatchObject({ code: '42501' });
    await expect(
      worker`insert into app_private.authorized_users (user_id) values (${randomUUID()})`,
    ).rejects.toMatchObject({
      code: '42501',
    });
  });
});

describe('credential repository', () => {
  it('stores only ciphertext and round-trips through encryption', async () => {
    await storeCredential(
      worker,
      keyring,
      alice,
      { refreshToken: 'rt-alice-123' },
      {
        grantedScopes: ['Mail.Read'],
        accessTokenExpiresAt: null,
      },
    );
    const [raw] =
      await owner`select ciphertext from app_private.oauth_credentials where account_id = ${alice.accountId}`;
    expect(Buffer.from(raw!.ciphertext as Buffer).toString('utf8')).not.toContain('rt-alice-123');
    await expect(loadCredential(worker, keyring, alice)).resolves.toEqual({
      refreshToken: 'rt-alice-123',
    });
  });

  it('does not return a credential to a different user', async () => {
    await expect(
      loadCredential(worker, keyring, { userId: bob.userId, accountId: alice.accountId }),
    ).resolves.toBeNull();
    expect(await deleteCredential(worker, { userId: bob.userId, accountId: alice.accountId })).toBe(
      false,
    );
  });

  it('refuses to store a credential against an account the user does not own', async () => {
    const details = { grantedScopes: [], accessTokenExpiresAt: null };
    // Alice's account already has a credential: the upsert must not overwrite it.
    await expect(
      storeCredential(
        worker,
        keyring,
        { userId: bob.userId, accountId: alice.accountId },
        { refreshToken: 'x' },
        details,
      ),
    ).rejects.toBeInstanceOf(CredentialOwnershipError);
    await expect(loadCredential(worker, keyring, alice)).resolves.toEqual({
      refreshToken: 'rt-alice-123',
    });
    // An account without a credential yet: the composite foreign key rejects it.
    const orphan = randomUUID();
    await owner`
      insert into public.mail_accounts (id, user_id, provider, provider_account_id, email_address)
      values (${orphan}, ${alice.userId}, 'google', ${orphan}, 'second@example.test')
    `;
    await expect(
      storeCredential(
        worker,
        keyring,
        { userId: bob.userId, accountId: orphan },
        { refreshToken: 'x' },
        details,
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('detects a ciphertext moved onto another account row', async () => {
    await storeCredential(
      worker,
      keyring,
      bob,
      { refreshToken: 'rt-bob' },
      { grantedScopes: [], accessTokenExpiresAt: null },
    );
    await owner`
      update app_private.oauth_credentials as target
      set ciphertext = source.ciphertext, nonce = source.nonce, auth_tag = source.auth_tag
      from app_private.oauth_credentials as source
      where target.account_id = ${bob.accountId} and source.account_id = ${alice.accountId}
    `;
    await expect(loadCredential(worker, keyring, bob)).rejects.toThrow('could not be decrypted');
  });
});

describe('audit repository', () => {
  it('records sanitized events and lists them per user only', async () => {
    await recordAuditEvent(worker, {
      userId: alice.userId,
      actor: 'user',
      eventType: 'settings.locale_changed',
      metadata: { locale: 'es', subject: 'Secret project', reason: 'contains spaces and @' },
    });
    await recordAuditEvent(worker, {
      userId: bob.userId,
      actor: 'user',
      eventType: 'auth.sign_in',
    });

    const events = await listAuditEventsForUser(worker, alice.userId);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('settings.locale_changed');
    expect(events[0]?.metadata).toEqual({ locale: 'es' });
  });
});

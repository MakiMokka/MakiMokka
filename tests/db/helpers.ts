import { randomUUID } from 'node:crypto';

import postgres from 'postgres';

import { TEST_DATABASE_URL } from './config';

export const sql = postgres(TEST_DATABASE_URL, { max: 4, onnotice: () => {} });

export type Tx = postgres.TransactionSql;

class Rollback extends Error {}

/** Run `fn` in a transaction that is always rolled back, keeping tests isolated. */
export async function inRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await sql.begin(async (tx) => {
      result = await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  return result as T;
}

/** Switch the transaction to a Supabase API role with the given JWT subject. */
export async function actAs(tx: Tx, role: 'anon' | 'authenticated', userId?: string) {
  await tx`reset role`;
  const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
  await tx`select set_config('request.jwt.claims', ${claims}, true)`;
  await tx.unsafe(`set local role ${role}`);
}

export async function actAsWorker(tx: Tx) {
  await tx`reset role`;
  await tx`select set_config('request.jwt.claims', '', true)`;
  await tx.unsafe('set local role app_worker');
}

export async function actAsOwner(tx: Tx) {
  await tx`reset role`;
}

/** Expect a statement to fail with a SQLSTATE, without aborting the outer transaction. */
export async function expectSqlState(tx: Tx, code: string, fn: (sp: Tx) => Promise<unknown>) {
  try {
    await tx.savepoint(async (sp) => {
      await fn(sp as unknown as Tx);
    });
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (actual !== code) {
      throw new Error(
        `Expected SQLSTATE ${code}, got ${actual ?? 'none'}: ${(error as Error).message}`,
      );
    }
    return;
  }
  throw new Error(`Expected SQLSTATE ${code}, but the statement succeeded`);
}

export interface Fixture {
  userId: string;
  accountId: string;
  messageId: string;
}

/** Create an auth user, optionally allowlisted, with one account and one message (as owner). */
export async function createUser(
  tx: Tx,
  options: { authorized?: boolean; withAccount?: boolean } = {},
): Promise<Fixture> {
  const { authorized = true, withAccount = true } = options;
  const userId = randomUUID();
  const accountId = randomUUID();
  const messageId = randomUUID();
  await actAsOwner(tx);
  await tx`insert into auth.users (id, email) values (${userId}, ${`${userId}@example.test`})`;
  if (authorized) {
    await tx`insert into app_private.authorized_users (user_id) values (${userId})`;
  } else {
    // Unauthorized users can still have a profile left over (e.g. after revocation).
    await tx`insert into public.profiles (id) values (${userId})`;
  }
  if (withAccount) {
    await tx`
      insert into public.mail_accounts (id, user_id, provider, provider_account_id, email_address, status, connected_at)
      values (${accountId}, ${userId}, 'microsoft', ${`acct-${accountId}`}, ${`${userId}@example.test`}, 'active', now())
    `;
    await tx`
      insert into public.message_metadata (id, user_id, account_id, provider_message_id, subject, sender_name, received_at)
      values (${messageId}, ${userId}, ${accountId}, ${`msg-${messageId}`}, 'Quarterly report', 'Ana Pérez', now())
    `;
  }
  return { userId, accountId, messageId };
}

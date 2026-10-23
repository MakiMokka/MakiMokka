import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import {
  actAs,
  actAsOwner,
  actAsWorker,
  createUser,
  expectSqlState,
  inRollback,
  sql,
} from './helpers';

const INSUFFICIENT_PRIVILEGE = '42501';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';

afterAll(async () => {
  await sql.end();
});

describe('profiles', () => {
  it('are created when a user is authorized', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx, { withAccount: false });
      const rows =
        await tx`select locale, time_zone from public.profiles where id = ${alice.userId}`;
      expect(rows).toEqual([{ locale: 'en', time_zone: 'UTC' }]);
    }));

  it('are visible and editable only by their owner', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      const visible = await tx`select id from public.profiles`;
      expect(visible.map((row) => row.id)).toEqual([alice.userId]);

      const updatedOther =
        await tx`update public.profiles set locale = 'es' where id = ${bob.userId}`;
      expect(updatedOther.count).toBe(0);
      const updatedOwn =
        await tx`update public.profiles set locale = 'es' where id = ${alice.userId}`;
      expect(updatedOwn.count).toBe(1);
    }));

  it('reject unsupported locales', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) => sp`update public.profiles set locale = 'fr' where id = ${alice.userId}`,
      );
    }));
});

describe('allowlist enforcement in RLS', () => {
  it('hides all data from authenticated users who are not allowlisted', () =>
    inRollback(async (tx) => {
      const mallory = await createUser(tx, { authorized: false });
      await actAs(tx, 'authenticated', mallory.userId);
      for (const table of [
        'profiles',
        'mail_accounts',
        'message_metadata',
        'follow_ups',
        'tasks',
        'saved_views',
      ]) {
        const rows = await tx.unsafe(`select 1 from public.${table}`);
        expect(rows.length, table).toBe(0);
      }
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`insert into public.tasks (user_id, title) values (${mallory.userId}, 'x')`,
      );
    }));

  it('revoking authorization immediately removes access to existing rows', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      expect((await tx`select 1 from public.mail_accounts`).length).toBe(1);

      await actAsOwner(tx);
      await tx`delete from app_private.authorized_users where user_id = ${alice.userId}`;

      await actAs(tx, 'authenticated', alice.userId);
      expect((await tx`select 1 from public.mail_accounts`).length).toBe(0);
      expect((await tx`select 1 from public.profiles`).length).toBe(0);
    }));

  it('gives anon no access at all', () =>
    inRollback(async (tx) => {
      await createUser(tx);
      await actAs(tx, 'anon');
      await expectSqlState(tx, INSUFFICIENT_PRIVILEGE, (sp) => sp`select * from public.profiles`);
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`select * from public.mail_accounts`,
      );
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`select app_security.is_authorized()`,
      );
    }));
});

describe('mail accounts and messages', () => {
  it('are isolated between users', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      const accounts = await tx`select id from public.mail_accounts`;
      const messages = await tx`select id from public.message_metadata`;
      expect(accounts.map((row) => row.id)).toEqual([alice.accountId]);
      expect(messages.map((row) => row.id)).toEqual([alice.messageId]);
      const byId = await tx`select id from public.mail_accounts where id = ${bob.accountId}`;
      expect(byId).toEqual([]);
    }));

  it('can be renamed by the owner but not re-assigned or re-statused', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      const renamed =
        await tx`update public.mail_accounts set display_name = 'Personal' where id = ${alice.accountId}`;
      expect(renamed.count).toBe(1);
      const renamedOther =
        await tx`update public.mail_accounts set display_name = 'Mine now' where id = ${bob.accountId}`;
      expect(renamedOther.count).toBe(0);
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) =>
          sp`update public.mail_accounts set user_id = ${bob.userId} where id = ${alice.accountId}`,
      );
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`update public.mail_accounts set status = 'active' where id = ${alice.accountId}`,
      );
    }));

  it('cannot be created or deleted by users', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) =>
          sp`insert into public.mail_accounts (user_id, provider, provider_account_id, email_address)
           values (${alice.userId}, 'google', 'fake', 'fake@example.test')`,
      );
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`delete from public.mail_accounts where id = ${alice.accountId}`,
      );
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`update public.message_metadata set is_read = true where id = ${alice.messageId}`,
      );
    }));

  it('reject a message whose user does not own the account (composite FK)', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);
      await actAsWorker(tx);
      await expectSqlState(
        tx,
        FOREIGN_KEY_VIOLATION,
        (sp) =>
          sp`insert into public.message_metadata (user_id, account_id, provider_message_id)
           values (${bob.userId}, ${alice.accountId}, 'm-1')`,
      );
    }));

  it('enforce unique provider ids and normalized email addresses', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAsWorker(tx);
      await expectSqlState(
        tx,
        UNIQUE_VIOLATION,
        (sp) =>
          sp`insert into public.message_metadata (user_id, account_id, provider_message_id)
           values (${alice.userId}, ${alice.accountId}, ${`msg-${alice.messageId}`})`,
      );
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) =>
          sp`insert into public.mail_accounts (user_id, provider, provider_account_id, email_address)
           values (${alice.userId}, 'google', 'g-1', 'Mixed@Example.test')`,
      );
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) =>
          sp`insert into public.mail_accounts (user_id, provider, provider_account_id, email_address, status)
           values (${alice.userId}, 'google', 'g-2', 'a@example.test', 'active')`,
      );
    }));

  it('supports metadata search on subject and sender', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      const hits =
        await tx`select id from public.message_metadata where search_vector @@ websearch_to_tsquery('simple', 'quarterly')`;
      expect(hits.map((row) => row.id)).toEqual([alice.messageId]);
    }));
});

describe('follow-ups, tasks and saved views', () => {
  it('allow full CRUD on own rows', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      const [task] = await tx`insert into public.tasks (user_id, title, source_message_id)
                              values (${alice.userId}, 'Reply to Ana', ${alice.messageId}) returning id`;
      await tx`update public.tasks set status = 'done', completed_at = now() where id = ${task!.id}`;
      const [followUp] = await tx`insert into public.follow_ups (user_id, title, due_at, message_id)
                                  values (${alice.userId}, 'Check reply', now() + interval '2 days', ${alice.messageId}) returning id`;
      await tx`insert into public.saved_views (user_id, name, definition) values (${alice.userId}, 'Unread', ${tx.json({ unread: true })})`;
      expect((await tx`select 1 from public.saved_views`).length).toBe(1);
      expect((await tx`delete from public.follow_ups where id = ${followUp!.id}`).count).toBe(1);
      expect((await tx`delete from public.tasks where id = ${task!.id}`).count).toBe(1);
    }));

  it('cannot be created for another user', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`insert into public.tasks (user_id, title) values (${bob.userId}, 'Injected')`,
      );
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) =>
          sp`insert into public.follow_ups (user_id, title, due_at) values (${bob.userId}, 'Injected', now())`,
      );
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) =>
          sp`insert into public.saved_views (user_id, name) values (${bob.userId}, 'Injected')`,
      );
    }));

  it("cannot reference another user's message even by id (composite FK)", () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      await expectSqlState(
        tx,
        FOREIGN_KEY_VIOLATION,
        (sp) =>
          sp`insert into public.follow_ups (user_id, title, due_at, message_id)
           values (${alice.userId}, 'Probe', now(), ${bob.messageId})`,
      );
      await expectSqlState(
        tx,
        FOREIGN_KEY_VIOLATION,
        (sp) =>
          sp`insert into public.tasks (user_id, title, source_message_id)
           values (${alice.userId}, 'Probe', ${bob.messageId})`,
      );
    }));

  it('are invisible to and immutable by other users', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);
      await actAs(tx, 'authenticated', bob.userId);
      const [task] =
        await tx`insert into public.tasks (user_id, title) values (${bob.userId}, 'Bob task') returning id`;
      await actAs(tx, 'authenticated', alice.userId);
      expect(await tx`select 1 from public.tasks`).toHaveLength(0);
      expect((await tx`update public.tasks set title = 'pwned' where id = ${task!.id}`).count).toBe(
        0,
      );
      expect((await tx`delete from public.tasks where id = ${task!.id}`).count).toBe(0);
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`update public.tasks set user_id = ${alice.userId} where id = ${task!.id}`,
      );
    }));

  it('enforce status/completion consistency and size limits', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) =>
          sp`insert into public.tasks (user_id, title, status) values (${alice.userId}, 'x', 'done')`,
      );
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) =>
          sp`insert into public.follow_ups (user_id, title, due_at, status) values (${alice.userId}, 'x', now(), 'done')`,
      );
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) =>
          sp`insert into public.saved_views (user_id, name, definition) values (${alice.userId}, 'arr', '[1,2]'::jsonb)`,
      );
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) => sp`insert into public.tasks (user_id, title) values (${alice.userId}, '')`,
      );
    }));

  it('keep a follow-up when its message is deleted', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      const [followUp] = await tx`insert into public.follow_ups (user_id, title, due_at, message_id)
                                  values (${alice.userId}, 'Keep me', now(), ${alice.messageId}) returning id`;
      await actAsWorker(tx);
      await tx`delete from public.message_metadata where id = ${alice.messageId}`;
      await actAs(tx, 'authenticated', alice.userId);
      const rows =
        await tx`select message_id, user_id from public.follow_ups where id = ${followUp!.id}`;
      expect(rows).toEqual([{ message_id: null, user_id: alice.userId }]);
    }));
});

describe('operational schemas', () => {
  it('are unreachable for authenticated users', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAs(tx, 'authenticated', alice.userId);
      for (const table of [
        'app_private.oauth_credentials',
        'app_private.sync_state',
        'app_private.sync_jobs',
        'app_private.authorized_users',
        'audit.events',
      ]) {
        await expectSqlState(tx, INSUFFICIENT_PRIVILEGE, (sp) =>
          sp.unsafe(`select * from ${table}`),
        );
      }
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`insert into app_private.authorized_users (user_id) values (${alice.userId})`,
      );
    }));

  it('validate credential envelopes and bind them to the owning account', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      const bob = await createUser(tx);
      await actAsWorker(tx);
      const nonce = Buffer.alloc(12, 1);
      const tag = Buffer.alloc(16, 2);
      await tx`insert into app_private.oauth_credentials (account_id, user_id, ciphertext, nonce, auth_tag, key_version)
               values (${alice.accountId}, ${alice.userId}, ${Buffer.from('ct')}, ${nonce}, ${tag}, 1)`;
      await expectSqlState(
        tx,
        FOREIGN_KEY_VIOLATION,
        (sp) =>
          sp`insert into app_private.oauth_credentials (account_id, user_id, ciphertext, nonce, auth_tag, key_version)
           values (${bob.accountId}, ${alice.userId}, ${Buffer.from('ct')}, ${nonce}, ${tag}, 1)`,
      );
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) =>
          sp`insert into app_private.oauth_credentials (account_id, user_id, ciphertext, nonce, auth_tag, key_version)
           values (${bob.accountId}, ${bob.userId}, ${Buffer.from('ct')}, ${Buffer.alloc(8)}, ${tag}, 1)`,
      );
    }));

  it('cascade credentials, sync state, jobs and messages when an account is removed', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAsWorker(tx);
      await tx`insert into app_private.oauth_credentials (account_id, user_id, ciphertext, nonce, auth_tag, key_version)
               values (${alice.accountId}, ${alice.userId}, ${Buffer.from('ct')}, ${Buffer.alloc(12)}, ${Buffer.alloc(16)}, 1)`;
      await tx`insert into app_private.sync_state (user_id, account_id, resource) values (${alice.userId}, ${alice.accountId}, 'mailbox')`;
      await tx`insert into app_private.sync_jobs (user_id, account_id, kind) values (${alice.userId}, ${alice.accountId}, 'initial')`;
      await tx`delete from public.mail_accounts where id = ${alice.accountId}`;
      const [counts] = await tx`
        select
          (select count(*) from app_private.oauth_credentials where account_id = ${alice.accountId})::int as credentials,
          (select count(*) from app_private.sync_state where account_id = ${alice.accountId})::int as state,
          (select count(*) from app_private.sync_jobs where account_id = ${alice.accountId})::int as jobs,
          (select count(*) from public.message_metadata where account_id = ${alice.accountId})::int as messages
      `;
      expect(counts).toEqual({ credentials: 0, state: 0, jobs: 0, messages: 0 });
    }));

  it('allow only one active sync job per account and kind', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAsWorker(tx);
      await tx`insert into app_private.sync_jobs (user_id, account_id, kind) values (${alice.userId}, ${alice.accountId}, 'incremental')`;
      await expectSqlState(
        tx,
        UNIQUE_VIOLATION,
        (sp) =>
          sp`insert into app_private.sync_jobs (user_id, account_id, kind) values (${alice.userId}, ${alice.accountId}, 'incremental')`,
      );
      await tx`update app_private.sync_jobs set status = 'succeeded', finished_at = now() where account_id = ${alice.accountId}`;
      await tx`insert into app_private.sync_jobs (user_id, account_id, kind) values (${alice.userId}, ${alice.accountId}, 'incremental')`;
    }));

  it('reject free-text error messages in sync tables', () =>
    inRollback(async (tx) => {
      const alice = await createUser(tx);
      await actAsWorker(tx);
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) =>
          sp`insert into app_private.sync_state (user_id, account_id, resource, last_error_code)
           values (${alice.userId}, ${alice.accountId}, 'mailbox', 'Message "Invoice for Ana" failed')`,
      );
      await tx`insert into app_private.sync_state (user_id, account_id, resource, last_error_code)
               values (${alice.userId}, ${alice.accountId}, 'mailbox', 'graph.throttled')`;
    }));
});

describe('audit events', () => {
  it('are append-only for everyone, including the table owner', () =>
    inRollback(async (tx) => {
      const userId = randomUUID();
      await actAsWorker(tx);
      await tx`insert into audit.events (user_id, actor, event_type) values (${userId}, 'user', 'auth.sign_in')`;
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`update audit.events set actor = 'system'`,
      );
      await expectSqlState(tx, INSUFFICIENT_PRIVILEGE, (sp) => sp`delete from audit.events`);
      await actAsOwner(tx);
      await expectSqlState(
        tx,
        INSUFFICIENT_PRIVILEGE,
        (sp) => sp`update audit.events set actor = 'system'`,
      );
      await expectSqlState(tx, INSUFFICIENT_PRIVILEGE, (sp) => sp`delete from audit.events`);
      await expectSqlState(tx, INSUFFICIENT_PRIVILEGE, (sp) => sp`truncate audit.events`);
    }));

  it('reject malformed event types and oversized metadata', () =>
    inRollback(async (tx) => {
      await actAsWorker(tx);
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) =>
          sp`insert into audit.events (actor, event_type) values ('user', 'Signed in as ana@example.com')`,
      );
      await expectSqlState(
        tx,
        CHECK_VIOLATION,
        (sp) =>
          sp`insert into audit.events (actor, event_type, metadata) values ('user', 'auth.sign_in', ${tx.json({ blob: 'x'.repeat(5000) })})`,
      );
    }));
});

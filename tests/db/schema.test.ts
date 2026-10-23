import { afterAll, describe, expect, it } from 'vitest';

import { TABLE_COLUMNS } from '@/lib/db/columns';

import { sql } from './helpers';

const SCHEMAS = ['public', 'app_private', 'audit'];
const TABLES = Object.keys(TABLE_COLUMNS);

afterAll(async () => {
  await sql.end();
});

describe('schema shape', () => {
  it('creates exactly the expected tables', async () => {
    const rows = await sql<{ name: string }[]>`
      select table_schema || '.' || table_name as name
      from information_schema.tables
      where table_schema in ${sql(SCHEMAS)} and table_type = 'BASE TABLE'
      order by 1
    `;
    expect(rows.map((row) => row.name)).toEqual([...TABLES].sort());
  });

  it.each(TABLES)('%s columns match src/lib/db/columns.ts', async (qualified) => {
    const [schema, table] = qualified.split('.');
    const rows = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = ${schema!} and table_name = ${table!}
      order by ordinal_position
    `;
    expect(rows.map((row) => row.column_name)).toEqual([
      ...TABLE_COLUMNS[qualified as keyof typeof TABLE_COLUMNS],
    ]);
  });

  it('never stores message bodies, snippets or attachments', async () => {
    const rows = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema in ${sql(SCHEMAS)}
        and column_name ~* '(body|snippet|preview|attachment_content|html|raw_mime|content)'
    `;
    expect(rows).toEqual([]);
  });

  it('stores no plaintext token columns', async () => {
    const rows = await sql<{ column_name: string }[]>`
      select table_name || '.' || column_name as column_name from information_schema.columns
      where table_schema in ${sql(SCHEMAS)} and column_name ~* '(token|secret|password)$'
    `;
    expect(rows).toEqual([]);
  });

  it('enables RLS on every table', async () => {
    const rows = await sql<{ name: string }[]>`
      select n.nspname || '.' || c.relname as name
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ${sql(SCHEMAS)} and c.relkind = 'r' and not c.relrowsecurity
    `;
    expect(rows).toEqual([]);
  });

  it('has no policy that applies to PUBLIC or anon', async () => {
    const rows = await sql<{ policyname: string }[]>`
      select policyname from pg_policies
      where schemaname in ${sql(SCHEMAS)} and (roles @> array['public']::name[] or roles @> array['anon']::name[])
    `;
    expect(rows).toEqual([]);
  });

  it('indexes the leading column of every foreign key', async () => {
    const rows = await sql<{ constraint_name: string }[]>`
      select con.conname as constraint_name
      from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace
      where con.contype = 'f' and n.nspname in ${sql(SCHEMAS)}
        and not exists (
          select 1 from pg_index i
          where i.indrelid = con.conrelid
            and i.indkey[0] = con.conkey[1]
        )
    `;
    expect(rows).toEqual([]);
  });

  it('pins search_path on every SECURITY DEFINER function', async () => {
    const rows = await sql<{ name: string }[]>`
      select n.nspname || '.' || p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.prosecdef and n.nspname in ('public', 'app_private', 'audit', 'app_security')
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
    `;
    expect(rows).toEqual([]);
  });
});

describe('privileges', () => {
  const privileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];

  it('grants anon nothing on any table', async () => {
    for (const table of TABLES) {
      for (const privilege of privileges) {
        const [row] = await sql<
          { allowed: boolean }[]
        >`select has_table_privilege('anon', ${table}, ${privilege}) as allowed`;
        expect(row?.allowed, `${privilege} on ${table}`).toBe(false);
      }
    }
  });

  it('keeps operational schemas away from API roles', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const schema of ['app_private', 'audit']) {
        const [row] = await sql<
          { allowed: boolean }[]
        >`select has_schema_privilege(${role}, ${schema}, 'USAGE') as allowed`;
        expect(row?.allowed, `${role} usage on ${schema}`).toBe(false);
      }
    }
  });

  it('never grants TRUNCATE, REFERENCES or TRIGGER to authenticated', async () => {
    for (const table of TABLES.filter((name) => name.startsWith('public.'))) {
      for (const privilege of ['TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        const [row] = await sql<
          { allowed: boolean }[]
        >`select has_table_privilege('authenticated', ${table}, ${privilege}) as allowed`;
        expect(row?.allowed, `${privilege} on ${table}`).toBe(false);
      }
    }
  });

  it('does not let authenticated insert or delete mail accounts or messages', async () => {
    for (const table of ['public.mail_accounts', 'public.message_metadata', 'public.profiles']) {
      for (const privilege of ['INSERT', 'DELETE']) {
        const [row] = await sql<
          { allowed: boolean }[]
        >`select has_table_privilege('authenticated', ${table}, ${privilege}) as allowed`;
        expect(row?.allowed, `${privilege} on ${table}`).toBe(false);
      }
    }
  });

  it('does not let authenticated update ownership or identity columns', async () => {
    const checks: [string, string][] = [
      ['public.profiles', 'id'],
      ['public.mail_accounts', 'user_id'],
      ['public.mail_accounts', 'status'],
      ['public.mail_accounts', 'email_address'],
      ['public.follow_ups', 'user_id'],
      ['public.tasks', 'user_id'],
      ['public.saved_views', 'user_id'],
      ['public.message_metadata', 'is_read'],
    ];
    for (const [table, column] of checks) {
      const [row] = await sql<{ allowed: boolean }[]>`
        select has_column_privilege('authenticated', ${table}, ${column}, 'UPDATE') as allowed
      `;
      expect(row?.allowed, `UPDATE(${column}) on ${table}`).toBe(false);
    }
  });

  it('gives app_worker read-only access to the allowlist', async () => {
    const [select] = await sql<
      { allowed: boolean }[]
    >`select has_table_privilege('app_worker', 'app_private.authorized_users', 'SELECT') as allowed`;
    const [insert] = await sql<
      { allowed: boolean }[]
    >`select has_table_privilege('app_worker', 'app_private.authorized_users', 'INSERT') as allowed`;
    expect(select?.allowed).toBe(true);
    expect(insert?.allowed).toBe(false);
  });

  it('does not let app_worker modify audit history or user-authored data', async () => {
    const checks: [string, string][] = [
      ['audit.events', 'UPDATE'],
      ['audit.events', 'DELETE'],
      ['public.tasks', 'SELECT'],
      ['public.follow_ups', 'SELECT'],
      ['public.saved_views', 'SELECT'],
      ['public.profiles', 'UPDATE'],
    ];
    for (const [table, privilege] of checks) {
      const [row] = await sql<
        { allowed: boolean }[]
      >`select has_table_privilege('app_worker', ${table}, ${privilege}) as allowed`;
      expect(row?.allowed, `${privilege} on ${table}`).toBe(false);
    }
  });

  it('exposes no executable functions to anon', async () => {
    const rows = await sql<{ name: string }[]>`
      select n.nspname || '.' || p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app_private', 'audit', 'app_security')
        and has_function_privilege('anon', p.oid, 'EXECUTE')
        and has_schema_privilege('anon', n.oid, 'USAGE')
    `;
    expect(rows).toEqual([]);
  });

  it('app_worker is not a login-capable superuser and cannot bypass RLS', async () => {
    const [row] = await sql<{ rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean }[]>`
      select rolsuper, rolbypassrls, rolcreaterole from pg_roles where rolname = 'app_worker'
    `;
    expect(row).toEqual({ rolsuper: false, rolbypassrls: false, rolcreaterole: false });
  });
});

-- Unified Mail — Phase 1 foundation
-- 0003: authorization helpers, grants and row-level security.
--
-- Principles
--   * Deny by default: revoke everything Supabase's default privileges grant
--     on public tables, then grant only what each role needs.
--   * anon gets nothing.
--   * authenticated users reach only their own rows AND only while they are
--     on the allowlist (app_private.authorized_users).
--   * app_worker (server-side code) gets the minimum needed for sync and
--     credential handling; the application layer always scopes its queries
--     to an authorized user (src/lib/auth/authorize.ts).

-- ---------------------------------------------------------------------------
-- Authorization helper used by every user-facing policy.
-- ---------------------------------------------------------------------------
create or replace function app_security.is_authorized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app_private.authorized_users au where au.user_id = (select auth.uid())
  );
$$;

revoke all on function app_security.is_authorized() from public;
grant execute on function app_security.is_authorized() to authenticated, app_worker;

-- ---------------------------------------------------------------------------
-- Reset grants on every table created by this foundation.
-- ---------------------------------------------------------------------------
revoke all on table
  public.profiles,
  public.mail_accounts,
  public.message_metadata,
  public.follow_ups,
  public.tasks,
  public.saved_views
from public, anon, authenticated;

revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all tables in schema audit from public, anon, authenticated;
revoke all on all sequences in schema audit from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
revoke all on all functions in schema audit from public, anon, authenticated;

-- Supabase may also grant to service_role by default. Server code in this
-- project never uses the service-role key; keep operational schemas out of
-- its reach as well.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on all tables in schema app_private from service_role';
    execute 'revoke all on all tables in schema audit from service_role';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (including non-exposed schemas, as defense in depth).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.mail_accounts enable row level security;
alter table public.message_metadata enable row level security;
alter table public.follow_ups enable row level security;
alter table public.tasks enable row level security;
alter table public.saved_views enable row level security;
alter table app_private.authorized_users enable row level security;
alter table app_private.oauth_credentials enable row level security;
alter table app_private.sync_state enable row level security;
alter table app_private.sync_jobs enable row level security;
alter table audit.events enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: owner may read and edit preference columns. Rows are created by
-- the authorization trigger, never by the client.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (display_name, locale, time_zone) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) and (select app_security.is_authorized()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select app_security.is_authorized()))
  with check (id = (select auth.uid()) and (select app_security.is_authorized()));

grant select on public.profiles to app_worker;
create policy profiles_worker_select on public.profiles
  for select to app_worker using (true);

-- ---------------------------------------------------------------------------
-- mail_accounts: owner may read and rename. Creating, deleting and changing
-- status happen server-side (OAuth flow, sync) as app_worker.
-- ---------------------------------------------------------------------------
grant select on public.mail_accounts to authenticated;
grant update (display_name) on public.mail_accounts to authenticated;

create policy mail_accounts_select_own on public.mail_accounts
  for select to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()));

create policy mail_accounts_update_own on public.mail_accounts
  for update to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()))
  with check (user_id = (select auth.uid()) and (select app_security.is_authorized()));

grant select, insert, update, delete on public.mail_accounts to app_worker;
create policy mail_accounts_worker_all on public.mail_accounts
  for all to app_worker using (true) with check (true);

-- ---------------------------------------------------------------------------
-- message_metadata: read-only for the owner. Mailbox state changes must go
-- through the provider API (Phase 2+) and are written back by sync.
-- ---------------------------------------------------------------------------
grant select on public.message_metadata to authenticated;

create policy message_metadata_select_own on public.message_metadata
  for select to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()));

grant select, insert, update, delete on public.message_metadata to app_worker;
create policy message_metadata_worker_all on public.message_metadata
  for all to app_worker using (true) with check (true);

-- ---------------------------------------------------------------------------
-- follow_ups, tasks, saved_views: full CRUD for the owner; immutable
-- columns (id, user_id, created_at) are excluded from UPDATE grants.
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.follow_ups to authenticated;
grant update (message_id, title, note, due_at, status, completed_at) on public.follow_ups to authenticated;

create policy follow_ups_select_own on public.follow_ups
  for select to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()));
create policy follow_ups_insert_own on public.follow_ups
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select app_security.is_authorized()));
create policy follow_ups_update_own on public.follow_ups
  for update to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()))
  with check (user_id = (select auth.uid()) and (select app_security.is_authorized()));
create policy follow_ups_delete_own on public.follow_ups
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()));

grant select, insert, delete on public.tasks to authenticated;
grant update (source_message_id, title, notes, status, priority, due_at, completed_at) on public.tasks to authenticated;

create policy tasks_select_own on public.tasks
  for select to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()));
create policy tasks_insert_own on public.tasks
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select app_security.is_authorized()));
create policy tasks_update_own on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()))
  with check (user_id = (select auth.uid()) and (select app_security.is_authorized()));
create policy tasks_delete_own on public.tasks
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()));

grant select, insert, delete on public.saved_views to authenticated;
grant update (name, definition, position) on public.saved_views to authenticated;

create policy saved_views_select_own on public.saved_views
  for select to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()));
create policy saved_views_insert_own on public.saved_views
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select app_security.is_authorized()));
create policy saved_views_update_own on public.saved_views
  for update to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()))
  with check (user_id = (select auth.uid()) and (select app_security.is_authorized()));
create policy saved_views_delete_own on public.saved_views
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select app_security.is_authorized()));

-- ---------------------------------------------------------------------------
-- app_private: app_worker only. The allowlist is read-only even for the
-- worker; operators manage it with SQL as the database owner.
-- ---------------------------------------------------------------------------
grant select on app_private.authorized_users to app_worker;
create policy authorized_users_worker_select on app_private.authorized_users
  for select to app_worker using (true);

grant select, insert, update, delete on app_private.oauth_credentials to app_worker;
create policy oauth_credentials_worker_all on app_private.oauth_credentials
  for all to app_worker using (true) with check (true);

grant select, insert, update, delete on app_private.sync_state to app_worker;
create policy sync_state_worker_all on app_private.sync_state
  for all to app_worker using (true) with check (true);

grant select, insert, update, delete on app_private.sync_jobs to app_worker;
create policy sync_jobs_worker_all on app_private.sync_jobs
  for all to app_worker using (true) with check (true);

-- ---------------------------------------------------------------------------
-- audit.events: app_worker may append and read; nobody may change history.
-- ---------------------------------------------------------------------------
grant select, insert on audit.events to app_worker;
create policy audit_events_worker_insert on audit.events
  for insert to app_worker with check (true);
create policy audit_events_worker_select on audit.events
  for select to app_worker using (true);

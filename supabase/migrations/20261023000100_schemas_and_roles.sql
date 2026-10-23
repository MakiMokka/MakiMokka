-- Unified Mail — Phase 1 foundation
-- 0001: schemas, roles and shared helpers.
--
-- Schema layout
--   public        User-owned data exposed through the Supabase Data API.
--                 Every table has RLS enabled and explicit, minimal grants.
--   app_private   Operational data (encrypted OAuth credentials, sync state,
--                 sync jobs, the authorization allowlist). NOT exposed through
--                 the Data API; no grants to anon/authenticated.
--   audit         Append-only security audit trail. Not exposed.
--   app_security  SECURITY DEFINER helper functions used by RLS policies.
--                 Contains no tables.
--
-- Roles
--   app_worker    NOLOGIN, least-privilege role used by server-side code via a
--                 direct Postgres connection (DATABASE_URL). An operator enables
--                 login for it manually during deployment (see docs/DEPLOYMENT.md);
--                 no credential is created by migrations.


do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_worker') then
    create role app_worker nologin noinherit nocreatedb nocreaterole noreplication;
  end if;
end
$$;

create schema if not exists app_private;
create schema if not exists audit;
create schema if not exists app_security;

revoke all on schema app_private from public;
revoke all on schema audit from public;
revoke all on schema app_security from public;

grant usage on schema app_private to app_worker;
grant usage on schema audit to app_worker;
grant usage on schema public to app_worker;
-- RLS policies call app_security.is_authorized(), so the API roles need
-- USAGE on this schema. It contains functions only.
grant usage on schema app_security to authenticated, app_worker;

-- Shared trigger: maintain updated_at.
create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function app_private.set_updated_at() from public;

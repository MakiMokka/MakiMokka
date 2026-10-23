-- Unified Mail — Phase 1 foundation
-- 0002: tables, constraints and indexes.
--
-- Data minimization: message bodies, previews/snippets and attachments are
-- never stored. Only the metadata needed to render lists, search by
-- subject/sender and link follow-ups and tasks is kept.
--
-- Ownership integrity: child rows reference their parent through a composite
-- (id, user_id) foreign key, so a row can never point at another user's
-- account or message even though foreign-key checks bypass RLS.

-- ---------------------------------------------------------------------------
-- Authorization allowlist (managed by an operator with SQL; see docs).
-- ---------------------------------------------------------------------------
create table app_private.authorized_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles: one per authorized user, created when the user is authorized.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 100),
  locale text not null default 'en' check (locale in ('en', 'es')),
  time_zone text not null default 'UTC' check (char_length(time_zone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app_private.set_updated_at();

create or replace function app_private.create_profile_for_authorized_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.user_id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function app_private.create_profile_for_authorized_user() from public;

create trigger authorized_users_create_profile
  after insert on app_private.authorized_users
  for each row execute function app_private.create_profile_for_authorized_user();

-- ---------------------------------------------------------------------------
-- Mail accounts (Microsoft Graph / Gmail). Rows are created only by the
-- server-side OAuth flow (Phase 2); nothing here represents a real
-- connection until that flow succeeds.
-- ---------------------------------------------------------------------------
create table public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('microsoft', 'google')),
  provider_account_id text not null check (char_length(provider_account_id) between 1 and 255),
  email_address text not null check (
    char_length(email_address) between 3 and 320 and email_address = lower(email_address)
  ),
  display_name text check (display_name is null or char_length(display_name) between 1 and 100),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'reauth_required', 'disabled', 'error')),
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mail_accounts_provider_identity_key unique (user_id, provider, provider_account_id),
  constraint mail_accounts_id_user_key unique (id, user_id),
  constraint mail_accounts_active_has_connected_at check (status <> 'active' or connected_at is not null)
);

create index mail_accounts_user_id_idx on public.mail_accounts (user_id);

create trigger mail_accounts_set_updated_at
  before update on public.mail_accounts
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Encrypted OAuth credentials. Encryption happens in the application
-- (AES-256-GCM, key held only in server env); the database only ever sees
-- ciphertext. Additional authenticated data binds each ciphertext to its
-- (user_id, account_id) so rows cannot be swapped between accounts.
-- ---------------------------------------------------------------------------
create table app_private.oauth_credentials (
  account_id uuid primary key,
  user_id uuid not null,
  ciphertext bytea not null check (octet_length(ciphertext) between 1 and 16384),
  nonce bytea not null check (octet_length(nonce) = 12),
  auth_tag bytea not null check (octet_length(auth_tag) = 16),
  key_version smallint not null check (key_version between 1 and 32767),
  granted_scopes text[] not null default '{}',
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oauth_credentials_account_fk foreign key (account_id, user_id)
    references public.mail_accounts (id, user_id) on delete cascade
);

create index oauth_credentials_user_id_idx on app_private.oauth_credentials (user_id);
create index oauth_credentials_key_version_idx on app_private.oauth_credentials (key_version);

create trigger oauth_credentials_set_updated_at
  before update on app_private.oauth_credentials
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Message metadata (no bodies, snippets or attachments).
-- ---------------------------------------------------------------------------
create table public.message_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid not null,
  provider_message_id text not null check (char_length(provider_message_id) between 1 and 512),
  provider_thread_id text check (provider_thread_id is null or char_length(provider_thread_id) between 1 and 512),
  internet_message_id text check (internet_message_id is null or char_length(internet_message_id) <= 998),
  provider_folder_ids text[] not null default '{}' check (cardinality(provider_folder_ids) <= 100),
  subject text check (subject is null or char_length(subject) <= 998),
  sender_name text check (sender_name is null or char_length(sender_name) <= 320),
  sender_address text check (sender_address is null or char_length(sender_address) <= 320),
  received_at timestamptz,
  sent_at timestamptz,
  is_read boolean not null default false,
  is_flagged boolean not null default false,
  is_draft boolean not null default false,
  importance text not null default 'normal' check (importance in ('low', 'normal', 'high')),
  has_attachments boolean not null default false,
  search_vector tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(subject, '') || ' ' || coalesce(sender_name, '') || ' ' || coalesce(sender_address, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_metadata_account_fk foreign key (account_id, user_id)
    references public.mail_accounts (id, user_id) on delete cascade,
  constraint message_metadata_provider_key unique (account_id, provider_message_id),
  constraint message_metadata_id_user_key unique (id, user_id)
);

create index message_metadata_user_received_idx
  on public.message_metadata (user_id, received_at desc nulls last);
create index message_metadata_account_received_idx
  on public.message_metadata (account_id, received_at desc nulls last);
create index message_metadata_thread_idx
  on public.message_metadata (account_id, provider_thread_id)
  where provider_thread_id is not null;
create index message_metadata_unread_idx
  on public.message_metadata (user_id, received_at desc)
  where is_read = false;
create index message_metadata_search_idx
  on public.message_metadata using gin (search_vector);

create trigger message_metadata_set_updated_at
  before update on public.message_metadata
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sync state (cursor per account/resource) and sync jobs (work queue).
-- ---------------------------------------------------------------------------
create table app_private.sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid not null,
  resource text not null check (resource ~ '^[a-z0-9_.:/-]{1,128}$'),
  cursor text check (cursor is null or char_length(cursor) <= 4096),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_.:-]{1,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_state_account_fk foreign key (account_id, user_id)
    references public.mail_accounts (id, user_id) on delete cascade,
  constraint sync_state_account_resource_key unique (account_id, resource)
);

create index sync_state_user_id_idx on app_private.sync_state (user_id);

create trigger sync_state_set_updated_at
  before update on app_private.sync_state
  for each row execute function app_private.set_updated_at();

create table app_private.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid not null,
  kind text not null check (kind in ('initial', 'incremental', 'notification', 'reconcile')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  priority smallint not null default 100 check (priority between 0 and 1000),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 50),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text check (locked_by is null or char_length(locked_by) <= 128),
  finished_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_.:-]{1,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_jobs_account_fk foreign key (account_id, user_id)
    references public.mail_accounts (id, user_id) on delete cascade,
  constraint sync_jobs_attempts_within_max check (attempts <= max_attempts),
  constraint sync_jobs_running_is_locked check (status <> 'running' or locked_at is not null),
  constraint sync_jobs_finished_state check (
    (status in ('succeeded', 'failed', 'cancelled')) = (finished_at is not null)
  )
);

-- At most one queued/running job per account and kind.
create unique index sync_jobs_one_active_per_kind_idx
  on app_private.sync_jobs (account_id, kind)
  where status in ('queued', 'running');
-- Queue polling.
create index sync_jobs_queue_idx
  on app_private.sync_jobs (priority, run_after)
  where status = 'queued';
create index sync_jobs_user_id_idx on app_private.sync_jobs (user_id);
create index sync_jobs_account_id_idx on app_private.sync_jobs (account_id, created_at desc);

create trigger sync_jobs_set_updated_at
  before update on app_private.sync_jobs
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Follow-ups and tasks (user-authored).
-- ---------------------------------------------------------------------------
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id uuid,
  title text not null check (char_length(title) between 1 and 500),
  note text check (note is null or char_length(note) <= 2000),
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_ups_message_fk foreign key (message_id, user_id)
    references public.message_metadata (id, user_id) on delete set null (message_id),
  constraint follow_ups_completed_state check ((status = 'open') = (completed_at is null))
);

create index follow_ups_user_status_due_idx on public.follow_ups (user_id, status, due_at);
create index follow_ups_message_id_idx on public.follow_ups (message_id) where message_id is not null;

create trigger follow_ups_set_updated_at
  before update on public.follow_ups
  for each row execute function app_private.set_updated_at();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_message_id uuid,
  title text not null check (char_length(title) between 1 and 500),
  notes text check (notes is null or char_length(notes) <= 5000),
  status text not null default 'open' check (status in ('open', 'done')),
  priority smallint not null default 0 check (priority between 0 and 3),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_source_message_fk foreign key (source_message_id, user_id)
    references public.message_metadata (id, user_id) on delete set null (source_message_id),
  constraint tasks_completed_state check ((status = 'done') = (completed_at is not null))
);

create index tasks_user_status_due_idx on public.tasks (user_id, status, due_at);
create index tasks_source_message_id_idx on public.tasks (source_message_id)
  where source_message_id is not null;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Saved views (named filter definitions).
-- ---------------------------------------------------------------------------
create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  definition jsonb not null default '{}'::jsonb check (
    jsonb_typeof(definition) = 'object' and pg_column_size(definition) <= 8192
  ),
  position integer not null default 0 check (position between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_views_user_name_key unique (user_id, name)
);

create index saved_views_user_position_idx on public.saved_views (user_id, position);

create trigger saved_views_set_updated_at
  before update on public.saved_views
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit events (append-only). No foreign key to users so the trail survives
-- user deletion. Metadata must never contain credentials or message content;
-- the application enforces an allowlist of keys and the database caps size.
-- ---------------------------------------------------------------------------
create table audit.events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  user_id uuid,
  actor text not null check (actor in ('user', 'system')),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,3}$'),
  target_type text check (target_type is null or target_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  target_id text check (target_id is null or char_length(target_id) <= 128),
  request_id text check (request_id is null or char_length(request_id) <= 128),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048
  )
);

create index audit_events_user_time_idx on audit.events (user_id, occurred_at desc);
create index audit_events_type_time_idx on audit.events (event_type, occurred_at desc);

create or replace function audit.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit.events is append-only' using errcode = '42501';
end;
$$;

revoke all on function audit.prevent_mutation() from public;

create trigger events_append_only
  before update or delete on audit.events
  for each row execute function audit.prevent_mutation();

create trigger events_no_truncate
  before truncate on audit.events
  for each statement execute function audit.prevent_mutation();

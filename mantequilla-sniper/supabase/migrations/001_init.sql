-- Mantequilla Reservation Sniper: esquema inicial.
-- Los datos personales del cliente (teléfono, correo) NO se guardan aquí; viven en variables de entorno del worker.

create extension if not exists pgcrypto;

-- Una sola reserva confirmada por campaña: la PK impide duplicados a nivel base de datos.
create table if not exists reservations (
  campaign_id text primary key,
  restaurant text not null,
  date date not null,
  time time not null,
  party_size int not null,
  guest_name text not null,
  confirmation_id text not null,
  status text not null check (status = 'CONFIRMED'),
  confirmed_at timestamptz not null,
  evidence text not null
);

create table if not exists booking_locks (
  campaign_id text primary key,
  holder text not null,
  expires_at timestamptz not null
);

-- Lock atómico con expiración (por si el worker muere a mitad de un intento).
create or replace function acquire_booking_lock(p_campaign_id text, p_holder text, p_ttl_ms int)
returns boolean language plpgsql as $$
begin
  insert into booking_locks (campaign_id, holder, expires_at)
  values (p_campaign_id, p_holder, now() + make_interval(secs => p_ttl_ms / 1000.0))
  on conflict (campaign_id) do update
    set holder = excluded.holder, expires_at = excluded.expires_at
    where booking_locks.expires_at < now() or booking_locks.holder = excluded.holder;
  return exists (select 1 from booking_locks where campaign_id = p_campaign_id and holder = p_holder);
end $$;

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  date date not null,
  time time not null,
  status text not null,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists attempts_campaign_idx on attempts (campaign_id, status);

create table if not exists transitions (
  id bigserial primary key,
  campaign_id text not null,
  from_state text not null,
  to_state text not null,
  reason text not null,
  at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  type text not null,
  message text not null,
  data jsonb,
  at timestamptz not null default now()
);
create index if not exists events_campaign_at_idx on events (campaign_id, at desc);

create table if not exists availability (
  campaign_id text not null,
  date date not null,
  status text not null,
  slots text[] not null default '{}',
  checked_at timestamptz not null,
  detail text,
  primary key (campaign_id, date)
);

create table if not exists worker_status (
  campaign_id text primary key,
  state text not null,
  next_release_at timestamptz,
  last_check_at timestamptz,
  heartbeat_at timestamptz not null,
  clock_offset_ms int
);

create table if not exists settings (
  campaign_id text primary key,
  mode text not null default 'ASSISTED' check (mode in ('AUTO', 'ASSISTED')),
  paused boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- RLS activado y sin políticas públicas: solo la service-role key (servidor) puede leer o escribir.
alter table reservations enable row level security;
alter table booking_locks enable row level security;
alter table attempts enable row level security;
alter table transitions enable row level security;
alter table events enable row level security;
alter table availability enable row level security;
alter table worker_status enable row level security;
alter table settings enable row level security;
alter table push_subscriptions enable row level security;

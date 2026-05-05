-- FAT CAT Match-3 Supabase schema
-- Manual rewards only. No token transfer automation.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  username text not null,
  total_xp integer not null default 0 check (total_xp >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  best_score integer not null default 0 check (best_score >= 0),
  total_checkins integer not null default 0 check (total_checkins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_wallet_format check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint users_username_format check (username ~ '^[A-Za-z0-9_-]{3,18}$')
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  username text not null,
  tx_signature text not null unique,
  checkin_date date not null,
  xp_awarded integer not null check (xp_awarded >= 0 and xp_awarded <= 1000),
  created_at timestamptz not null default now(),
  constraint checkins_wallet_format check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint checkins_username_format check (username ~ '^[A-Za-z0-9_-]{3,18}$'),
  constraint checkins_one_per_day unique (wallet_address, checkin_date),
  constraint checkins_user_fk foreign key (wallet_address) references public.users(wallet_address) on update cascade on delete cascade
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  username text not null,
  score integer not null check (score >= 0 and score <= 1000000),
  level integer not null check (level >= 1 and level <= 1000),
  moves_used integer not null check (moves_used >= 0 and moves_used <= 10000),
  game_session_id text not null unique,
  tx_signature text not null unique,
  suspicious_score boolean not null default false,
  suspicious_reason text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint scores_wallet_format check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint scores_username_format check (username ~ '^[A-Za-z0-9_-]{3,18}$'),
  constraint scores_user_fk foreign key (wallet_address) references public.users(wallet_address) on update cascade on delete cascade
);

alter table public.scores add column if not exists suspicious_reason text;

create index if not exists idx_users_best_score on public.users (best_score desc);
create index if not exists idx_users_wallet_address on public.users (wallet_address);
create index if not exists idx_users_total_xp on public.users (total_xp desc);
create index if not exists idx_users_current_streak on public.users (current_streak desc);
create index if not exists idx_checkins_wallet_date on public.checkins (wallet_address, checkin_date desc);
create index if not exists idx_checkins_checkin_date on public.checkins (checkin_date desc);
create index if not exists idx_scores_wallet_created on public.scores (wallet_address, created_at desc);
create index if not exists idx_scores_score on public.scores (score desc);
create index if not exists idx_scores_created_at on public.scores (created_at desc);
create index if not exists idx_scores_game_session_id on public.scores (game_session_id);
create index if not exists idx_scores_reviewed on public.scores (reviewed, suspicious_score);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.checkins enable row level security;
alter table public.scores enable row level security;

-- =========================================================
-- Production RLS hardening
-- =========================================================
-- This setup assumes you mint authenticated JWTs that include:
-- app_metadata.wallet_address (preferred) or wallet_address claim.
-- If the claim is missing, writes/reads to protected tables are denied.

create or replace function public.jwt_wallet_address()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'wallet_address', ''),
    nullif(auth.jwt() ->> 'wallet_address', '')
  );
$$;

create table if not exists public.wallet_sessions (
  token_hash text primary key,
  wallet_address text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint wallet_sessions_wallet_format check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);

create index if not exists idx_wallet_sessions_wallet on public.wallet_sessions (wallet_address);
create index if not exists idx_wallet_sessions_expires on public.wallet_sessions (expires_at);

create or replace function public.wallet_address_from_session_header()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  raw_headers json;
  session_token text;
  resolved_wallet text;
begin
  raw_headers := current_setting('request.headers', true)::json;
  session_token := nullif(raw_headers ->> 'x-wallet-session', '');

  if session_token is null then
    return null;
  end if;

  select ws.wallet_address
  into resolved_wallet
  from public.wallet_sessions ws
  where ws.token_hash = encode(digest(session_token, 'sha256'), 'hex')
    and ws.expires_at > now()
  limit 1;

  return resolved_wallet;
end;
$$;

grant execute on function public.wallet_address_from_session_header() to anon, authenticated;

create or replace function public.current_wallet_address()
returns text
language sql
stable
as $$
  select coalesce(public.jwt_wallet_address(), public.wallet_address_from_session_header());
$$;

grant execute on function public.current_wallet_address() to anon, authenticated;

alter table public.wallet_sessions enable row level security;
revoke all on table public.wallet_sessions from anon, authenticated;

revoke all on table public.users from anon;
revoke all on table public.checkins from anon;
revoke all on table public.scores from anon;

drop policy if exists users_select_public on public.users;
drop policy if exists users_insert_public on public.users;
drop policy if exists users_update_public on public.users;
drop policy if exists checkins_select_public on public.checkins;
drop policy if exists checkins_insert_public on public.checkins;
drop policy if exists scores_select_public on public.scores;
drop policy if exists scores_insert_public on public.scores;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
for select
to anon, authenticated
using (wallet_address = public.current_wallet_address());

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
for insert
to anon, authenticated
with check (
  wallet_address = public.current_wallet_address()
  and wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  and username ~ '^[A-Za-z0-9_-]{3,18}$'
  and total_xp >= 0
  and current_streak >= 0
  and best_score >= 0
  and total_checkins >= 0
);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
for update
to anon, authenticated
using (wallet_address = public.current_wallet_address())
with check (
  wallet_address = public.current_wallet_address()
  and wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  and username ~ '^[A-Za-z0-9_-]{3,18}$'
  and total_xp >= 0
  and current_streak >= 0
  and best_score >= 0
  and total_checkins >= 0
);

drop policy if exists checkins_select_own on public.checkins;
create policy checkins_select_own on public.checkins
for select
to anon, authenticated
using (wallet_address = public.current_wallet_address());

drop policy if exists checkins_insert_own on public.checkins;
create policy checkins_insert_own on public.checkins
for insert
to anon, authenticated
with check (
  wallet_address = public.current_wallet_address()
  and wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  and username ~ '^[A-Za-z0-9_-]{3,18}$'
  and xp_awarded >= 0 and xp_awarded <= 1000
  and checkin_date = (now() at time zone 'utc')::date
);

drop policy if exists scores_select_own on public.scores;
create policy scores_select_own on public.scores
for select
to anon, authenticated
using (wallet_address = public.current_wallet_address());

drop policy if exists scores_insert_own on public.scores;
create policy scores_insert_own on public.scores
for insert
to anon, authenticated
with check (
  wallet_address = public.current_wallet_address()
  and wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  and username ~ '^[A-Za-z0-9_-]{3,18}$'
  and score >= 0 and score <= 1000000
  and level >= 1 and level <= 1000
  and moves_used >= 0 and moves_used <= 10000
  and reviewed = false
);

-- Public leaderboard surface: safe read-only subset.
create or replace view public.leaderboard_public as
select
  wallet_address,
  username,
  best_score,
  current_streak,
  total_xp,
  total_checkins,
  updated_at
from public.users;

grant select on public.leaderboard_public to anon, authenticated;

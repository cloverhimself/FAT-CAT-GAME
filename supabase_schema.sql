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
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint scores_wallet_format check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint scores_username_format check (username ~ '^[A-Za-z0-9_-]{3,18}$'),
  constraint scores_user_fk foreign key (wallet_address) references public.users(wallet_address) on update cascade on delete cascade
);

create index if not exists idx_users_best_score on public.users (best_score desc);
create index if not exists idx_users_total_xp on public.users (total_xp desc);
create index if not exists idx_users_current_streak on public.users (current_streak desc);
create index if not exists idx_checkins_wallet_date on public.checkins (wallet_address, checkin_date desc);
create index if not exists idx_scores_wallet_created on public.scores (wallet_address, created_at desc);
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

-- Basic public policies for client-side app using anon key.
-- For stronger protection in production, add authenticated wallet/session verification middleware.

drop policy if exists users_select_public on public.users;
create policy users_select_public on public.users
for select using (true);

drop policy if exists users_insert_public on public.users;
create policy users_insert_public on public.users
for insert with check (true);

drop policy if exists users_update_public on public.users;
create policy users_update_public on public.users
for update using (true) with check (true);

drop policy if exists checkins_select_public on public.checkins;
create policy checkins_select_public on public.checkins
for select using (true);

drop policy if exists checkins_insert_public on public.checkins;
create policy checkins_insert_public on public.checkins
for insert with check (true);

drop policy if exists scores_select_public on public.scores;
create policy scores_select_public on public.scores
for select using (true);

drop policy if exists scores_insert_public on public.scores;
create policy scores_insert_public on public.scores
for insert with check (true);
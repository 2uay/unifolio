-- Unifolio Supabase Schema
-- Run this once in the Supabase SQL Editor

create extension if not exists "uuid-ossp";

-- Institutions (user-owned)
create table if not exists institutions (
  id               text primary key,
  user_id          uuid references auth.users not null,
  name             text not null,
  type             text,
  country          text,
  logo             text,
  color            text,
  connection_status text default 'not_connected',
  last_sync_time   timestamptz,
  api_supported    boolean default false,
  notes            text,
  created_at       timestamptz default now()
);
alter table institutions enable row level security;
create policy "users own their institutions" on institutions
  for all using (auth.uid() = user_id);

-- Accounts
create table if not exists accounts (
  id                    text primary key,
  user_id               uuid references auth.users not null,
  institution_id        text references institutions(id),
  account_name          text not null,
  account_type          text,
  base_currency         text default 'USD',
  cash_balance          numeric default 0,
  included_in_portfolio boolean default true,
  last_updated          timestamptz default now(),
  created_at            timestamptz default now()
);
alter table accounts enable row level security;
create policy "users own their accounts" on accounts
  for all using (auth.uid() = user_id);

-- Holdings
create table if not exists holdings (
  id                        text primary key,
  user_id                   uuid references auth.users not null,
  account_id                text references accounts(id),
  ticker                    text not null,
  quantity                  numeric default 0,
  average_price             numeric default 0,
  realized_gain_loss_amount numeric default 0,
  purchase_history          jsonb default '[]',
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);
alter table holdings enable row level security;
create policy "users own their holdings" on holdings
  for all using (auth.uid() = user_id);

-- Transactions
create table if not exists transactions (
  id               text primary key,
  user_id          uuid references auth.users not null,
  account_id       text references accounts(id),
  date             date not null,
  transaction_type text not null,
  ticker           text,
  quantity         numeric default 0,
  price            numeric default 0,
  total_amount     numeric default 0,
  currency         text default 'USD',
  notes            text,
  created_at       timestamptz default now()
);
alter table transactions enable row level security;
create policy "users own their transactions" on transactions
  for all using (auth.uid() = user_id);

-- Watchlist
create table if not exists watchlist (
  id           text primary key,
  user_id      uuid references auth.users not null,
  ticker       text not null,
  name         text,
  target_price numeric,
  notes        text,
  created_at   timestamptz default now()
);
alter table watchlist enable row level security;
create policy "users own their watchlist" on watchlist
  for all using (auth.uid() = user_id);

-- User Profiles (preferences + picture)
create table if not exists user_profiles (
  id                          uuid primary key default uuid_generate_v4(),
  user_id                     uuid references auth.users not null unique,
  full_name                   text,
  display_name                text,
  profile_picture_url         text,
  profile_picture_type        text default 'static',
  profile_picture_file_name   text,
  default_currency            text default 'USD',
  theme_id                    text,
  secondary_color_palette_id  text,
  privacy_mode_preference     boolean default false,
  simulated_live_data_enabled boolean default true,
  accent_bars_enabled         boolean default true,
  heatmap_enabled             boolean default true,
  heatmap_mode                text,
  sidebar_preference          text default 'open',
  stack_assets                boolean default false,
  holdings_columns            jsonb,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);
alter table user_profiles enable row level security;
create policy "users own their profile" on user_profiles
  for all using (auth.uid() = user_id);

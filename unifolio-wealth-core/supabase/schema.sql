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
alter table holdings add column if not exists asset_name text;
alter table holdings add column if not exists asset_class text;
alter table holdings add column if not exists sub_category text;
alter table holdings add column if not exists currency text default 'USD';
alter table holdings add column if not exists current_price numeric default 0;
alter table holdings add column if not exists market_value numeric default 0;
alter table holdings add column if not exists cost_basis numeric default 0;
alter table holdings add column if not exists unrealized_gain_loss_amount numeric default 0;
alter table holdings add column if not exists unrealized_gain_loss_percent numeric default 0;
alter table holdings add column if not exists daily_pnl_amount numeric default 0;
alter table holdings add column if not exists daily_pnl_percent numeric default 0;
alter table holdings add column if not exists exchange text;
alter table holdings add column if not exists country text;
alter table holdings add column if not exists sector text default 'Unknown';
alter table holdings add column if not exists conid text;
alter table holdings add column if not exists report_date date;
alter table holdings add column if not exists import_batch_id text;
alter table holdings add column if not exists security_key text;
alter table holdings add column if not exists display_ticker text;
alter table holdings add column if not exists quote_symbol text;
alter table holdings add column if not exists listing_exchange text;
alter table holdings add column if not exists listing_currency text;
alter table holdings add column if not exists security_identity text;
alter table holdings add column if not exists identity_confidence text;
alter table holdings add column if not exists underlying_ticker text;

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
alter table transactions add column if not exists fees numeric default 0;
alter table transactions add column if not exists settlement_date date;
alter table transactions add column if not exists asset_name text;
alter table transactions add column if not exists asset_class text;
alter table transactions add column if not exists source_section text;
alter table transactions add column if not exists import_batch_id text;
alter table transactions add column if not exists broker_transaction_id text;
alter table transactions add column if not exists transfer_direction text;
alter table transactions add column if not exists source_account_id text;
alter table transactions add column if not exists destination_account_id text;
alter table transactions add column if not exists transfer_context jsonb default '{}'::jsonb;
alter table transactions add column if not exists security_key text;
alter table transactions add column if not exists display_ticker text;
alter table transactions add column if not exists quote_symbol text;
alter table transactions add column if not exists listing_exchange text;
alter table transactions add column if not exists listing_currency text;
alter table transactions add column if not exists security_identity text;
alter table transactions add column if not exists identity_confidence text;
alter table transactions add column if not exists underlying_ticker text;
alter table transactions add column if not exists transfer_edited_at timestamptz;

-- Realized Positions
create table if not exists realized_positions (
  id                           text primary key,
  user_id                      uuid references auth.users not null,
  account_id                   text references accounts(id),
  ticker                       text not null,
  asset_name                   text,
  asset_class                  text,
  sector                       text default 'Unknown',
  country                      text,
  exchange                     text,
  currency                     text default 'USD',
  quantity                     numeric default 0,
  average_buy_price            numeric default 0,
  average_sell_price           numeric default 0,
  total_cost_basis             numeric default 0,
  total_sale_value             numeric default 0,
  realized_gain_loss_amount    numeric default 0,
  realized_gain_loss_percent   numeric default 0,
  open_date                    date,
  close_date                   date,
  holding_period_days          integer,
  position_status              text default 'Realized',
  source_section               text,
  import_batch_id              text,
  broker_transaction_id        text,
  created_at                   timestamptz default now(),
  updated_at                   timestamptz default now()
);
alter table realized_positions enable row level security;
create policy "users own their realized positions" on realized_positions
  for all using (auth.uid() = user_id);
create index if not exists realized_positions_user_close_idx
  on realized_positions (user_id, close_date desc);
alter table realized_positions add column if not exists security_key text;
alter table realized_positions add column if not exists display_ticker text;
alter table realized_positions add column if not exists quote_symbol text;
alter table realized_positions add column if not exists listing_exchange text;
alter table realized_positions add column if not exists listing_currency text;
alter table realized_positions add column if not exists security_identity text;
alter table realized_positions add column if not exists identity_confidence text;
alter table realized_positions add column if not exists underlying_ticker text;

-- Import Batches
-- Stores the normalized import payload for audit/replay without keeping the raw broker file.
create table if not exists import_batches (
  id                 text primary key,
  user_id            uuid references auth.users not null,
  broker             text not null,
  institution_id     text references institutions(id),
  account_id         text references accounts(id),
  file_name          text not null,
  file_size          bigint,
  status             text default 'synced',
  summary            jsonb default '{}',
  report_metadata    jsonb default '{}',
  normalized_payload jsonb default '{}',
  imported_at        timestamptz default now(),
  created_at         timestamptz default now()
);
alter table import_batches enable row level security;
create policy "users own their import batches" on import_batches
  for all using (auth.uid() = user_id);
create index if not exists import_batches_user_imported_idx
  on import_batches (user_id, imported_at desc);

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
  active_import_batch_id       text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);
alter table user_profiles enable row level security;
create policy "users own their profile" on user_profiles
  for all using (auth.uid() = user_id);
alter table user_profiles add column if not exists active_import_batch_id text;

-- Server-side delete helpers
-- These avoid long chains of browser/PostgREST delete requests timing out.
create or replace function delete_unifolio_account(p_account_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_counts jsonb := '{}'::jsonb;
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from accounts
    where id = p_account_id and user_id = v_user_id
  ) then
    raise exception 'Account not found';
  end if;

  delete from holdings where user_id = v_user_id and account_id = p_account_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('holdings', v_deleted);

  delete from realized_positions where user_id = v_user_id and account_id = p_account_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('realized_positions', v_deleted);

  delete from transactions where user_id = v_user_id and account_id = p_account_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('transactions', v_deleted);

  delete from import_batches where user_id = v_user_id and account_id = p_account_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('import_batches', v_deleted);

  delete from accounts where user_id = v_user_id and id = p_account_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('accounts', v_deleted);

  return v_counts;
end;
$$;

create or replace function delete_unifolio_user_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_counts jsonb := '{}'::jsonb;
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from holdings where user_id = v_user_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('holdings', v_deleted);

  delete from realized_positions where user_id = v_user_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('realized_positions', v_deleted);

  delete from transactions where user_id = v_user_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('transactions', v_deleted);

  delete from import_batches where user_id = v_user_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('import_batches', v_deleted);

  delete from watchlist where user_id = v_user_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('watchlist', v_deleted);

  delete from accounts where user_id = v_user_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('accounts', v_deleted);

  delete from institutions where user_id = v_user_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('institutions', v_deleted);

  delete from user_profiles where user_id = v_user_id;
  get diagnostics v_deleted = row_count;
  v_counts := v_counts || jsonb_build_object('user_profiles', v_deleted);

  return v_counts;
end;
$$;

grant execute on function delete_unifolio_account(text) to authenticated;
grant execute on function delete_unifolio_user_data() to authenticated;

-- Storage bucket for user avatar images
-- Run this block in Supabase SQL Editor if not already applied.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$
begin
  -- Public read access
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Avatar images are publicly accessible'
  ) then
    execute $p$
      create policy "Avatar images are publicly accessible" on storage.objects
        for select using (bucket_id = 'avatars');
    $p$;
  end if;

  -- Users can upload their own avatar (path must start with their user_id)
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Users can upload their own avatar'
  ) then
    execute $p$
      create policy "Users can upload their own avatar" on storage.objects
        for insert with check (
          bucket_id = 'avatars'
          and auth.uid()::text = (storage.foldername(name))[1]
        );
    $p$;
  end if;

  -- Users can overwrite/update their own avatar
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Users can update their own avatar'
  ) then
    execute $p$
      create policy "Users can update their own avatar" on storage.objects
        for update using (
          bucket_id = 'avatars'
          and auth.uid()::text = (storage.foldername(name))[1]
        );
    $p$;
  end if;

  -- Users can delete their own avatar
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Users can delete their own avatar'
  ) then
    execute $p$
      create policy "Users can delete their own avatar" on storage.objects
        for delete using (
          bucket_id = 'avatars'
          and auth.uid()::text = (storage.foldername(name))[1]
        );
    $p$;
  end if;
end;
$$;

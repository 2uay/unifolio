-- ============================================================
-- Unifolio migration — 2026-05-16
-- Apply by pasting into Supabase Dashboard → SQL Editor → Run.
-- Idempotent: every alter/create uses IF NOT EXISTS, and functions
-- use CREATE OR REPLACE. Safe to re-run.
--
-- Adds:
--   - Tax Optimizer inputs on user_profiles (marginal_tax_rate, province,
--     spouse_marginal_tax_rate, extra_accounts_paid)
--   - billing_orders table + Stripe customer/sub ids on user_profiles
--   - households / household_members / household_invites tables + RLS
--   - get_household_holdings() + get_household_recent_transactions() RPC
--   - billing_orders period tracking columns + cron index
-- ============================================================

-- ─── user_profiles additions ───────────────────────────────────
alter table user_profiles add column if not exists marginal_tax_rate numeric;
alter table user_profiles add column if not exists province text;
alter table user_profiles add column if not exists extra_accounts_paid integer default 0;
alter table user_profiles add column if not exists stripe_customer_id text;
alter table user_profiles add column if not exists stripe_subscription_id text;
alter table user_profiles add column if not exists spouse_marginal_tax_rate numeric;

-- ─── billing_orders ────────────────────────────────────────────
create table if not exists billing_orders (
  id              text primary key default gen_random_uuid()::text,
  user_id         uuid not null references auth.users(id) on delete cascade,
  plan_id         text not null,
  billing_method  text not null,
  currency        text not null,
  amount_total    integer,
  status          text not null default 'pending',
  external_id     text,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table billing_orders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='billing_orders' and policyname='users read own billing orders'
  ) then
    execute 'create policy "users read own billing orders" on billing_orders for select using (auth.uid() = user_id)';
  end if;
end$$;

create index if not exists billing_orders_user_time on billing_orders(user_id, created_at desc);
create index if not exists billing_orders_status on billing_orders(status, created_at desc);

-- Sprint D: crypto subscription period tracking
alter table billing_orders add column if not exists period_starts_at timestamptz;
alter table billing_orders add column if not exists period_ends_at timestamptz;
alter table billing_orders add column if not exists renewed_from_order_id text references billing_orders(id);
create index if not exists billing_orders_period_ends on billing_orders(period_ends_at) where status = 'paid' and billing_method = 'crypto_coinbase';

-- ─── households ────────────────────────────────────────────────
create table if not exists households (
  id                uuid primary key default gen_random_uuid(),
  primary_user_id   uuid not null references auth.users(id) on delete cascade,
  display_name      text,
  created_at        timestamptz not null default now()
);
alter table households enable row level security;

create table if not exists household_members (
  household_id      uuid not null references households(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  role              text not null default 'spouse',
  joined_at         timestamptz not null default now(),
  primary key (household_id, user_id)
);
alter table household_members enable row level security;

create table if not exists household_invites (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  invited_email     text not null,
  invite_token      text not null unique,
  status            text not null default 'pending',
  invited_by        uuid not null references auth.users(id) on delete cascade,
  expires_at        timestamptz not null default (now() + interval '14 days'),
  created_at        timestamptz not null default now(),
  accepted_at       timestamptz
);
alter table household_invites enable row level security;
create index if not exists household_invites_token on household_invites(invite_token);
create index if not exists household_invites_email on household_invites(invited_email, status);
create index if not exists household_members_user on household_members(user_id);

-- Idempotent RLS policies (wrapped in do/exists checks so re-running is safe).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='households' and policyname='household members read household') then
    execute 'create policy "household members read household" on households for select using (exists (select 1 from household_members hm where hm.household_id = households.id and hm.user_id = auth.uid()))';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='households' and policyname='household primary writes household') then
    execute 'create policy "household primary writes household" on households for all using (auth.uid() = primary_user_id) with check (auth.uid() = primary_user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='household_members' and policyname='household members see roster') then
    execute 'create policy "household members see roster" on household_members for select using (exists (select 1 from household_members self where self.household_id = household_members.household_id and self.user_id = auth.uid()))';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='household_members' and policyname='household primary writes members') then
    execute 'create policy "household primary writes members" on household_members for insert with check (exists (select 1 from households h where h.id = household_id and h.primary_user_id = auth.uid()))';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='household_members' and policyname='household members can leave') then
    execute 'create policy "household members can leave" on household_members for delete using (auth.uid() = user_id or exists (select 1 from households h where h.id = household_id and h.primary_user_id = auth.uid()))';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='household_invites' and policyname='inviter reads own invites') then
    execute 'create policy "inviter reads own invites" on household_invites for select using (auth.uid() = invited_by)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='household_invites' and policyname='inviter writes invites') then
    execute 'create policy "inviter writes invites" on household_invites for all using (auth.uid() = invited_by) with check (auth.uid() = invited_by)';
  end if;
end$$;

-- ─── Household-scoped read functions ───────────────────────────
-- SECURITY DEFINER so they bypass holdings/transactions RLS to let
-- household co-members read each other's tickers + recent trades,
-- projecting only the columns needed (no account-level detail).

create or replace function get_household_holdings()
returns table (owner_user_id uuid, ticker text, quantity numeric, currency text, account_type text, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select h.user_id, h.ticker, h.quantity, h.currency, h.account_type, h.updated_at
  from holdings h
  where h.user_id = auth.uid()
     or h.user_id in (
       select hm.user_id
       from household_members hm
       where hm.household_id in (
         select hm2.household_id from household_members hm2 where hm2.user_id = auth.uid()
       )
     );
$$;
grant execute on function get_household_holdings() to authenticated;

create or replace function get_household_recent_transactions(since_days integer default 35)
returns table (owner_user_id uuid, ticker text, transaction_type text, trade_date date, quantity numeric, currency text)
language sql
security definer
set search_path = public
as $$
  select t.user_id, t.ticker, t.transaction_type, t.trade_date, t.quantity, t.currency
  from transactions t
  where t.trade_date >= (current_date - (since_days || ' days')::interval)
    and (
      t.user_id = auth.uid()
      or t.user_id in (
        select hm.user_id
        from household_members hm
        where hm.household_id in (
          select hm2.household_id from household_members hm2 where hm2.user_id = auth.uid()
        )
      )
    );
$$;
grant execute on function get_household_recent_transactions(integer) to authenticated;

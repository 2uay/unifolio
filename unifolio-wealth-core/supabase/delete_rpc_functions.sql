-- Unifolio delete RPC functions
-- Paste this whole file into Supabase SQL Editor and run it once.

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

-- Optional validation:
select proname
from pg_proc
where proname in ('delete_unifolio_account', 'delete_unifolio_user_data');

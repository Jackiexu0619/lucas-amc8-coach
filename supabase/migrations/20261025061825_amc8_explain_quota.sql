-- Separate cost ledger. No learner payload or revision is read or changed when charging a request.
create table if not exists public.amc8_explain_quota (
  sync_hash text not null,
  window_key text not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (sync_hash, window_key)
);
alter table public.amc8_explain_quota enable row level security;
revoke all on public.amc8_explain_quota from public, anon, authenticated;

create or replace function public.amc8_explain_authorize_and_charge(p_sync_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stamp timestamp;
  v_day text;
  v_minute text;
  v_day_count integer;
  v_minute_count integer;
begin
  if p_sync_hash is null or p_sync_hash !~ '^[a-f0-9]{64}$' then
    return 'unauthorized';
  end if;
  if not exists (select 1 from public.amc8_sync_state where sync_hash = p_sync_hash) then
    return 'unauthorized';
  end if;

  -- Serialize charges for the same sync code across Edge Function instances.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_sync_hash, 0));
  v_stamp := pg_catalog.timezone('UTC', pg_catalog.clock_timestamp());
  v_day := 'day:' || pg_catalog.to_char(v_stamp, 'YYYYMMDD');
  v_minute := 'minute:' || pg_catalog.to_char(v_stamp, 'YYYYMMDDHH24MI');
  select request_count into v_day_count from public.amc8_explain_quota
    where sync_hash = p_sync_hash and window_key = v_day;
  select request_count into v_minute_count from public.amc8_explain_quota
    where sync_hash = p_sync_hash and window_key = v_minute;
  if coalesce(v_day_count, 0) >= 30 or coalesce(v_minute_count, 0) >= 10 then
    return 'rate_limited';
  end if;
  insert into public.amc8_explain_quota(sync_hash, window_key, request_count)
    values (p_sync_hash, v_day, 1)
    on conflict (sync_hash, window_key) do update
      set request_count = public.amc8_explain_quota.request_count + 1,
          updated_at = pg_catalog.now();
  insert into public.amc8_explain_quota(sync_hash, window_key, request_count)
    values (p_sync_hash, v_minute, 1)
    on conflict (sync_hash, window_key) do update
      set request_count = public.amc8_explain_quota.request_count + 1,
          updated_at = pg_catalog.now();
  return 'ok';
end;
$$;
revoke all on function public.amc8_explain_authorize_and_charge(text) from public, anon, authenticated;
grant execute on function public.amc8_explain_authorize_and_charge(text) to service_role;

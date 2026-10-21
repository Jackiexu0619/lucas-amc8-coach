-- Lucas AMC8 Coach v0.6.3 — dedicated Supabase schema
-- Applied to project: lucas-amc8 (Tokyo)
-- Do not use service_role keys in the browser.

create table if not exists public.amc8_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  device_id text,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.amc8_user_state enable row level security;
grant select, insert, update, delete on public.amc8_user_state to authenticated;

drop policy if exists "amc8_select_own_state" on public.amc8_user_state;
create policy "amc8_select_own_state" on public.amc8_user_state
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "amc8_insert_own_state" on public.amc8_user_state;
create policy "amc8_insert_own_state" on public.amc8_user_state
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "amc8_update_own_state" on public.amc8_user_state;
create policy "amc8_update_own_state" on public.amc8_user_state
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "amc8_delete_own_state" on public.amc8_user_state;
create policy "amc8_delete_own_state" on public.amc8_user_state
for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.amc8_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_amc8_touch_updated_at on public.amc8_user_state;
create trigger trg_amc8_touch_updated_at
before update on public.amc8_user_state
for each row execute function public.amc8_touch_updated_at();

create index if not exists amc8_user_state_updated_at_idx
on public.amc8_user_state(updated_at desc);

revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

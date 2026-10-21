-- Lucas AMC8 Coach v0.6.3 — dedicated Supabase schema
-- Run this migration only in the dedicated AMC8 project.

create table if not exists public.amc8_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.amc8_user_state enable row level security;

grant select, insert, update on public.amc8_user_state to authenticated;

drop policy if exists "amc8_select_own" on public.amc8_user_state;
create policy "amc8_select_own"
on public.amc8_user_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "amc8_insert_own" on public.amc8_user_state;
create policy "amc8_insert_own"
on public.amc8_user_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "amc8_update_own" on public.amc8_user_state;
create policy "amc8_update_own"
on public.amc8_user_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_amc8_updated_at()
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

drop trigger if exists trg_amc8_updated_at on public.amc8_user_state;
create trigger trg_amc8_updated_at
before update on public.amc8_user_state
for each row execute procedure public.set_amc8_updated_at();

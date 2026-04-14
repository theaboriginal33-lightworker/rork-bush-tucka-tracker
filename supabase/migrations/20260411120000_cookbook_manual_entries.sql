-- Saved Cook / Tucka Guide rows (manual entries only). Syncs across devices when user logs in.
-- Run in Supabase SQL Editor if you do not use CLI migrations.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.cookbook_manual_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create index if not exists cookbook_manual_entries_user_updated_idx
  on public.cookbook_manual_entries (user_id, updated_at desc);

drop trigger if exists cookbook_manual_entries_set_updated_at on public.cookbook_manual_entries;
create trigger cookbook_manual_entries_set_updated_at
  before update on public.cookbook_manual_entries
  for each row
  execute function public.set_updated_at();

alter table public.cookbook_manual_entries enable row level security;

drop policy if exists "cookbook_manual_select_own" on public.cookbook_manual_entries;
drop policy if exists "cookbook_manual_insert_own" on public.cookbook_manual_entries;
drop policy if exists "cookbook_manual_update_own" on public.cookbook_manual_entries;
drop policy if exists "cookbook_manual_delete_own" on public.cookbook_manual_entries;

create policy "cookbook_manual_select_own"
  on public.cookbook_manual_entries
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "cookbook_manual_insert_own"
  on public.cookbook_manual_entries
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "cookbook_manual_update_own"
  on public.cookbook_manual_entries
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "cookbook_manual_delete_own"
  on public.cookbook_manual_entries
  for delete
  to authenticated
  using (user_id = auth.uid());

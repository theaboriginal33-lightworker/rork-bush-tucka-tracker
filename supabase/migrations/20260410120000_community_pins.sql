-- Community map pins: one row per pin, jsonb payload matches app CommunityPin (minus user scoping).
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

create table if not exists public.community_pins (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create index if not exists community_pins_user_created_idx
  on public.community_pins (user_id, created_at desc);

-- Requires public.set_updated_at() from scan_journal migration (create it if missing).
drop trigger if exists community_pins_set_updated_at on public.community_pins;
create trigger community_pins_set_updated_at
  before update on public.community_pins
  for each row
  execute function public.set_updated_at();

alter table public.community_pins enable row level security;

drop policy if exists "community_pins_select_own" on public.community_pins;
drop policy if exists "community_pins_insert_own" on public.community_pins;
drop policy if exists "community_pins_update_own" on public.community_pins;
drop policy if exists "community_pins_delete_own" on public.community_pins;

create policy "community_pins_select_own"
  on public.community_pins
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "community_pins_insert_own"
  on public.community_pins
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "community_pins_update_own"
  on public.community_pins
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "community_pins_delete_own"
  on public.community_pins
  for delete
  to authenticated
  using (user_id = auth.uid());

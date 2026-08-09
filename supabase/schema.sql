-- InterviewIQ cloud sync — run once in the Supabase SQL editor (or via
-- scripts/setup-supabase.js). Each row is one synced storage key for one user.
create table public.user_sync (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at bigint not null,
  primary key (user_id, key)
);

alter table public.user_sync enable row level security;

create policy "read own rows"  on public.user_sync for select using (auth.uid() = user_id);
create policy "insert own rows" on public.user_sync for insert with check (auth.uid() = user_id);
create policy "update own rows" on public.user_sync for update using (auth.uid() = user_id);
create policy "delete own rows" on public.user_sync for delete using (auth.uid() = user_id);

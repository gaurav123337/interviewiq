-- InterviewIQ opt-in leaderboard (Phase 3, item 17) — run once in the Supabase
-- SQL editor (or via scripts/setup-live.js, which applies this file as part of
-- the schema batch). Idempotent: safe to re-run.
--
-- Privacy model
--   A row exists ONLY after the user explicitly opts in (the app inserts on
--   opt-in and deletes on opt-out). Public read therefore exposes nothing but
--   self-published display-name + derived stats — never an email, never a
--   non-consenting user. The numbers are a client snapshot (XP is derived from
--   the user's own session history) and are therefore self-reported; RLS still
--   guarantees a user can only write their OWN row, so no one can tamper with
--   or impersonate another entry. Server-authoritative scoring is a possible
--   future hardening, out of scope for the current testing phase.

create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  xp int not null default 0,
  level int not null default 1,
  streak int not null default 0,
  sessions int not null default 0,
  updated_at bigint not null default 0
);

create index if not exists leaderboard_xp_idx on public.leaderboard (xp desc);

alter table public.leaderboard enable row level security;

/* public read — the board is meant to be seen by everyone (the skill_signals /
   jobs / pdf_chunks public-read idiom). Only opted-in rows exist to read. */
drop policy if exists "leaderboard public read" on public.leaderboard;
create policy "leaderboard public read" on public.leaderboard for select using (true);

/* owner write — a user may only insert/update/delete their own row
   (the user_sync 4-policy owner split). */
drop policy if exists "leaderboard insert own" on public.leaderboard;
create policy "leaderboard insert own" on public.leaderboard for insert with check (auth.uid() = user_id);

drop policy if exists "leaderboard update own" on public.leaderboard;
create policy "leaderboard update own" on public.leaderboard for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leaderboard delete own" on public.leaderboard;
create policy "leaderboard delete own" on public.leaderboard for delete using (auth.uid() = user_id);

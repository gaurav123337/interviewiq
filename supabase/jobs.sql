/* ------------------------------------------------------------------ */
/* Jobs feature — career profiles + the ATS job feed (Phase 1)          */
/* ------------------------------------------------------------------ */
/* `career_profiles` holds the user's professional profile (skills,
   experience, targets) — the single source of truth for the job matcher
   and, later, resume/cover-letter generation. `jobs` is the public feed
   pulled from ATS boards (Greenhouse / Lever / Ashby) by the jobs-fetch
   Edge Function; everyone can read it, only admins write it. */

create table if not exists public.career_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.career_profiles enable row level security;
drop policy if exists "career profile own" on public.career_profiles;
create policy "career profile own" on public.career_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* The uploaded resume (parsed text + extracted profile) — follows the user
   across devices, exactly like career_profiles. Local storage stays the
   source of truth; this row is a best-effort backup when signed in. */
create table if not exists public.uploaded_resumes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.uploaded_resumes enable row level security;
drop policy if exists "uploaded resume own" on public.uploaded_resumes;
create policy "uploaded resume own" on public.uploaded_resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.jobs (
  id bigint generated always as identity primary key,
  source text not null,
  external_id text not null,
  title text not null,
  company text not null,
  location text,
  remote boolean not null default false,
  description text not null default '',
  url text not null default '',
  skills jsonb not null default '[]'::jsonb,
  level text,
  salary jsonb,
  company_size text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

alter table public.jobs add column if not exists salary jsonb;
alter table public.jobs add column if not exists company_size text;

alter table public.jobs enable row level security;
drop policy if exists "jobs public read" on public.jobs;
create policy "jobs public read" on public.jobs for select using (true);
drop policy if exists "jobs admin all" on public.jobs;
create policy "jobs admin all" on public.jobs
  for all using (public.is_admin()) with check (public.is_admin());

create index if not exists jobs_posted_idx on public.jobs (posted_at desc nulls last);

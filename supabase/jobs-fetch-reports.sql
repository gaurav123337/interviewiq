-- Per-source refresh reports for the job feed.  jobs-fetch writes one row
-- after every refresh (per-source job counts + any source errors), so the
-- Admin dashboard can surface a failing board — like the old lever:fampay
-- "time zone displacement" bug — instead of it silently logging in the
-- function logs.  Admin-read only (RLS is_admin()); the function writes via
-- the service role (bypasses RLS).  Values are counts + error strings —
-- never secrets.

create table if not exists public.jobs_fetch_reports (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  added int not null default 0,
  updated int not null default 0,
  total int not null default 0,
  per_source jsonb not null default '{}'::jsonb,
  errors jsonb not null default '{}'::jsonb
);

alter table public.jobs_fetch_reports enable row level security;

-- admin-only read — never public
drop policy if exists "jobs fetch reports admin read" on public.jobs_fetch_reports;
create policy "jobs fetch reports admin read" on public.jobs_fetch_reports
  for select using (public.is_admin());

-- keep the table small: prune everything but the most recent 20 reports
drop trigger if exists "prune jobs_fetch_reports" on public.jobs_fetch_reports;
create or replace function public.prune_jobs_fetch_reports()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.jobs_fetch_reports
  where id not in (select id from public.jobs_fetch_reports order by id desc limit 20);
  return new;
end $$;
create trigger "prune jobs_fetch_reports" after insert on public.jobs_fetch_reports
for each row execute function public.prune_jobs_fetch_reports();

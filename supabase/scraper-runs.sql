-- Scraper run reports (Phase 4 Item B).  Both the GitHub Actions cron
-- (scripts/scrape-sources.js, via the management API) and the dashboard's
-- "Run now" (src/services/scraper.ts) write one row per run, so the Admin
-- dashboard can see WHICH websites ran, when, what they extracted and what
-- failed — instead of the browser's localStorage-only history.
--
-- Mirrors supabase/jobs-fetch-reports.sql: values are counts + error strings —
-- never secrets.  RLS: admin read + admin insert (is_admin()) — the dashboard's
-- "Run now" writes its manual report with the signed-in admin's JWT, so it
-- needs a permissive INSERT policy; the cron writes via the management API
-- (service role, bypasses RLS) and needs none.

create table if not exists public.scraper_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  trigger text not null default 'manual' check (trigger in ('cron', 'manual')),
  status text not null default 'ok' check (status in ('ok', 'partial', 'failed')),
  per_source jsonb not null default '{}'::jsonb,
  inserted int not null default 0,
  errors int not null default 0
);

alter table public.scraper_runs enable row level security;

-- admin-only read — never public
drop policy if exists "scraper runs admin read" on public.scraper_runs;
create policy "scraper runs admin read" on public.scraper_runs
  for select using (public.is_admin());

-- admin insert — the browser's manual run report (runScraperNow →
-- recordScraperRun) inserts under the signed-in admin's JWT; without this
-- policy PostgREST would deny it and the report would silently not persist
-- (the cron path is unaffected — management-API writes bypass RLS).
drop policy if exists "scraper runs admin insert" on public.scraper_runs;
create policy "scraper runs admin insert" on public.scraper_runs
  for insert with check (public.is_admin());

-- keep the table small: prune everything but the most recent 50 runs
drop trigger if exists "prune scraper_runs" on public.scraper_runs;
create or replace function public.prune_scraper_runs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.scraper_runs
  where id not in (select id from public.scraper_runs order by id desc limit 50);
  return new;
end $$;
create trigger "prune scraper_runs" after insert on public.scraper_runs
for each row execute function public.prune_scraper_runs();

-- filters used by the run-log card: newest first, by trigger, by status
create index if not exists scraper_runs_ran_at_idx on public.scraper_runs (ran_at desc);
create index if not exists scraper_runs_trigger_idx on public.scraper_runs (trigger);
create index if not exists scraper_runs_status_idx on public.scraper_runs (status);

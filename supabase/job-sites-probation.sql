/* job-sites-probation — Greenhouse/Ashby boards become first-class auto-apply
   targets, and pending discoveries stop waiting forever for manual approval.

   Part 1: the jobs-fetch pipeline registers every live greenhouse/ashby board
   as a job_sites row with source 'ats' (constraint extended below).

   Part 2: probation auto-activation. A pending site with a jobs_url that has
   sat in the queue longer than the probation window (default 7 days) is
   flipped to 'active' by engine_activate_probation_sites() — oldest first,
   capped per sweep (default 3) so the blast radius stays small. The engine
   calls it at every --all cycle start (and --discover), DMs the owner, and
   the registry's rules.probation stamp records when/why. The owner can still
   approve early or reject a site any time; a site may also opt out per-row
   via rules.probation.skip = true. */

alter table public.job_sites drop constraint if exists job_sites_source_check;
alter table public.job_sites add constraint job_sites_source_check
  check (source in ('builtin', 'discovered', 'manual', 'ats'));

/* Probation sweep — service role (the local engine) or admin. Returns the
   rows it activated so the caller can report them honestly. */
drop function if exists public.engine_activate_probation_sites(int, int);
create or replace function public.engine_activate_probation_sites(p_days int default 7, p_max int default 3)
returns table (host text, label text, jobs_url text, discovered_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  return query
  update public.job_sites s
    set status = 'active',
        approved_at = now(),
        updated_at = now(),
        rules = coalesce(s.rules, '{}'::jsonb) || jsonb_build_object(
          'probation', jsonb_build_object('activated_at', now(), 'days', greatest(p_days, 1), 'by', 'probation-auto'))
    where s.id in (
      select c.id
      from public.job_sites c
      where c.status = 'pending'
        and c.jobs_url is not null
        and c.discovered_at <= now() - make_interval(days => greatest(p_days, 1))
        and coalesce((c.rules -> 'probation' ->> 'skip')::boolean, false) = false
      order by c.discovered_at asc
      limit greatest(least(p_max, 10), 1)
    )
  returning s.host, s.label, s.jobs_url, s.discovered_at;
end $$;

revoke execute on function public.engine_activate_probation_sites(int, int) from anon, public;

/* registry listing gains the probation timeline (discovered_at + approved_at)
   so the UI can show "auto-activates <date>" on pending rows — and keeps the
   three-state session columns session-state.sql added (a listing that drops
   them silently breaks the session-health strip in the registry UI). */
drop function if exists public.admin_list_job_sites();
create or replace function public.admin_list_job_sites()
returns table (
  id uuid, host text, label text, jobs_url text, status text, source text,
  rules jsonb, session_ok boolean, last_run_at timestamptz,
  last_submitted int, last_collected int, last_ok boolean,
  session_state text, session_checked_at timestamptz, session_expired_at timestamptz,
  discovered_at timestamptz, approved_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  /* definer = RLS does not apply to this function, so the guard is the gate
     (the previous unguarded version returned the registry to anyone with
     the publishable key). */
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  return query
  select s.id, s.host, s.label, s.jobs_url, s.status, s.source,
         s.rules, s.session_ok, s.last_run_at,
         coalesce((s.last_result ->> 'submitted')::int, 0),
         coalesce((s.last_result ->> 'collected')::int, 0),
         coalesce((s.last_result ->> 'ok')::boolean, false),
         s.session_state, s.session_checked_at, s.session_expired_at,
         s.discovered_at, s.approved_at
  from public.job_sites s
  order by (s.status = 'active') desc, s.host;
end $$;

revoke execute on function public.admin_list_job_sites() from anon, public;
grant execute on function public.admin_list_job_sites() to authenticated, service_role;

/* ── Part 3: owner-only RLS on the registry tables ──────────────────────
   job-sites.sql's header claimed "RLS restricted to the single admin user",
   but RLS was never enabled: the publishable key could read job_sites and
   job_site_runs straight through PostgREST. The definer RPCs above/below run
   as the table owner, so they keep working; the local engine uses the service
   role, which bypasses RLS. */
alter table public.job_sites enable row level security;

drop policy if exists "job sites admin" on public.job_sites;
create policy "job sites admin" on public.job_sites
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.job_site_runs enable row level security;

drop policy if exists "job site runs admin" on public.job_site_runs;
create policy "job site runs admin" on public.job_site_runs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


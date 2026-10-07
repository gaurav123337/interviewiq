/* job_sites — self-discovering board registry for the auto-apply engine.
   Discovery inserts rows with status 'pending'; the owner approves them in
   the UI (Admin → Job sites), which flips status to 'active' — the engine
   only ever applies on 'active' sites. Learned selector rules live in
   `rules` and are updated by the engine when a site's markup changes.
   Owner-only: RLS restricted to the single admin user; service role bypasses. */

create table if not exists public.job_sites (
  id uuid primary key default gen_random_uuid(),
  host text not null unique,
  label text not null,
  jobs_url text,
  status text not null default 'pending' check (status in ('pending','active','disabled','dead')),
  source text not null default 'discovered' check (source in ('builtin','discovered','manual')),
  rules jsonb not null default '{}'::jsonb,
  session_ok boolean not null default false,
  last_run_at timestamptz,
  last_result jsonb,
  discovered_at timestamptz default now(),
  approved_at timestamptz,
  updated_at timestamptz default now()
);

/* engine run bookkeeping (shared by the local engine via service key) */
create table if not exists public.job_site_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.job_sites(id) on delete cascade,
  host text,
  ran_at timestamptz default now(),
  ok boolean,
  collected int default 0,
  submitted int default 0,
  skipped int default 0,
  errors int default 0,
  notes text
);

create index if not exists job_site_runs_site_idx on public.job_site_runs (site_id, ran_at desc);

/* ── owner-only, enforced ──────────────────────────────────────────────
   The header above always claimed "RLS restricted to the single admin
   user", but RLS was never enabled here — so the public (publishable) key
   could read the whole registry, hosts, rules and session verdicts through
   PostgREST. Same for the run log. Policies below are the gate; the
   `security definer` RPCs are owned by the table owner and keep working.
   (Verified leak: anon GET /rest/v1/job_sites returned rows.) */
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

/* ── admin RPCs (same guard pattern as billing) ───────────────────────── */

create or replace function public.is_job_sites_admin()
returns boolean language sql security definer set search_path = public as $$
  select public.is_admin();
$$;

/* list sites + last run summary for the admin UI. `security definer` means
   the RLS policies above do NOT apply to this function, so it carries the
   same explicit admin guard as the engine RPCs — without it, anyone holding
   the publishable key could call it and read the registry. */
create or replace function public.admin_list_job_sites()
returns table (
  id uuid, host text, label text, jobs_url text, status text, source text,
  rules jsonb, session_ok boolean, last_run_at timestamptz,
  last_submitted int, last_collected int, last_ok boolean
) language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  return query
  select s.id, s.host, s.label, s.jobs_url, s.status, s.source,
         s.rules, s.session_ok, s.last_run_at,
         coalesce((s.last_result ->> 'submitted')::int, 0),
         coalesce((s.last_result ->> 'collected')::int, 0),
         coalesce((s.last_result ->> 'ok')::boolean, false)
  from public.job_sites s
  order by (s.status = 'active') desc, s.host;
end $$;

/* approve a discovered site (pending → active) */
create or replace function public.admin_set_job_site_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('pending','active','disabled','dead') then raise exception 'bad status'; end if;
  update public.job_sites
    set status = p_status,
        approved_at = case when p_status = 'active' then now() else approved_at end,
        updated_at = now()
    where id = p_id;
end $$;

/* engine upsert from discovery / rule learning (service role or admin) */
create or replace function public.engine_upsert_job_site(
  p_host text, p_label text, p_jobs_url text, p_source text,
  p_rules jsonb default null, p_session_ok boolean default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  select id into sid from public.job_sites where host = p_host;
  if sid is null then
    insert into public.job_sites (host, label, jobs_url, source, rules, session_ok)
    values (p_host, p_label, p_jobs_url, p_source, coalesce(p_rules, '{}'::jsonb), coalesce(p_session_ok, false))
    returning id into sid;
  else
    update public.job_sites
      set label = coalesce(p_label, label),
          jobs_url = coalesce(p_jobs_url, jobs_url),
          rules = coalesce(p_rules, rules),
          session_ok = coalesce(p_session_ok, session_ok),
          updated_at = now()
      where id = sid;
  end if;
  return sid;
end $$;

/* engine writes a run row + updates the site's last_result (service or admin) */
create or replace function public.engine_record_job_site_run(
  p_host text, p_ok boolean, p_collected int, p_submitted int,
  p_skipped int, p_errors int, p_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  select id into sid from public.job_sites where host = p_host;
  if sid is null then return; end if;
  insert into public.job_site_runs (site_id, host, ok, collected, submitted, skipped, errors, notes)
    values (sid, p_host, p_ok, p_collected, p_submitted, p_skipped, p_errors, p_notes);
  update public.job_sites
    set last_run_at = now(),
        last_result = jsonb_build_object('ok', p_ok, 'collected', p_collected,
          'submitted', p_submitted, 'skipped', p_skipped, 'errors', p_errors,
          'notes', p_notes),
        updated_at = now()
    where id = sid;
end $$;

/* engine rule learning: merge learned selectors into rules (service or admin) */
create or replace function public.engine_set_job_site_rules(p_host text, p_rules jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  update public.job_sites
    set rules = coalesce(rules, '{}'::jsonb) || p_rules, updated_at = now()
    where host = p_host;
end $$;

/* ── execute grants ────────────────────────────────────────────────────
   Postgres grants EXECUTE on new functions to PUBLIC by default, so the
   in-function guards are the only thing standing between the publishable
   key and these RPCs. Revoke that default: the client calls the two admin
   listing/approval RPCs as a signed-in admin; the engine_* writers are
   service-role only (the local engine + the jobs-fetch edge function). */
revoke execute on function public.admin_list_job_sites() from anon, public;
grant execute on function public.admin_list_job_sites() to authenticated, service_role;

revoke execute on function public.admin_set_job_site_status(uuid, text) from anon, public;
grant execute on function public.admin_set_job_site_status(uuid, text) to authenticated, service_role;

revoke execute on function public.engine_upsert_job_site(text, text, text, text, jsonb, boolean) from anon, public;
grant execute on function public.engine_upsert_job_site(text, text, text, text, jsonb, boolean) to service_role;

revoke execute on function public.engine_record_job_site_run(text, boolean, int, int, int, int, text) from anon, public;
grant execute on function public.engine_record_job_site_run(text, boolean, int, int, int, int, text) to service_role;

revoke execute on function public.engine_set_job_site_rules(text, jsonb) from anon, public;
grant execute on function public.engine_set_job_site_rules(text, jsonb) to service_role;

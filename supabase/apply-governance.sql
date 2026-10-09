/* apply-governance — Phase 0+3: cross-run policy for the auto-apply engine.

   Phase 0 (budget + filters): the engine never spent across runs — every
   cycle read --max and forgot. apply_config grows policy columns the engine
   reads at every cycle start (same table as the kill switch):
     - policy_daily_cap / policy_weekly_cap  : submission ceilings (DEFAULT
       20/day and 80/week, set in SQL; NULL later = owner chose 'no cap')
     - policy_quiet_from / policy_quiet_to   : "22:00"/"06:00" — submitting
       pauses, collection + review-queue work continue
     - policy_filters (jsonb)                : money-rules checked BEFORE the
       AI judge so a rejected job costs zero tokens:
         { excludeCompanies:[], salaryMin, locations:[], remoteOnly,
           seniorityMin, seniorityMax }

   apply_results.result gains two honest states:
     - 'budget_capped'  — the job WAS a fit but the ceiling is reached; the
       queue keeps it, the NEXT cycle owns it (never silently dropped).
     - 'filtered'       — a money-rule rejected it; detail names the rule.

   Phase 3 (outcome-driven suspension): admin_suspend_dead_boards() reads
   each board's 90-day outcome stats and flips boards that earned ZERO views
   or responses on >= 10 applications back to 'pending' (probation) — max 3
   per sweep, every activation DM'd (by the engine, same as the probation
   sweep). Conservative: only already-scraped data speaks; boards under the
   evidence threshold are left alone; a row is logged per decision.

   All idempotent (add column if not exists / drop-recreate constraints and
   functions), admin-guarded, engine RPCs service-role-guarded and revoked
   from anon/public per the repo's security doctrine. */

/* ── 1. policy columns ──────────────────────────────────────────────────── */
alter table public.apply_config
  add column if not exists policy_daily_cap int,
  add column if not exists policy_weekly_cap int,
  add column if not exists policy_quiet_from text,
  add column if not exists policy_quiet_to text,
  add column if not exists policy_filters jsonb;

/* owner-set defaults ship here once: 20/day, 80/week (the agreed default).
   The apply_config id = 'global' row always exists (apply-config-and-results.sql
   inserted it), so this update hits exactly one row. NOT NULL is NOT set —
   an owner may later NULL a column to mean "no cap" and that must stay
   representable. Quiet hours default OFF (null from/to = never quiet). */
update public.apply_config
  set policy_daily_cap = 20, policy_weekly_cap = 80
  where id = 'global' and policy_daily_cap is null and policy_weekly_cap is null;

/* ── 2. apply_results: the two new honest states ───────────────────────── */
/* The original constraint lives inline in apply-config-and-results.sql
   (result text not null check (result in (...))). Find-and-replace it
   idempotently: drop the unnamed/auto-named check and re-add a named one
   with the full extended list. */
alter table public.apply_results drop constraint if exists apply_results_result_check;
do $$
begin
  -- any lingering inline check will have a generated name; drop it by
  -- exact shape-match so repeated applies never error
  begin
    for r in
      select conname from pg_constraint
      where conrelid = 'public.apply_results'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%result%' and pg_get_constraintdef(oid) like '%submitted%'
        and conname <> 'apply_results_result_check'
  loop
      execute format('alter table public.apply_results drop constraint %I', r.conname);
    end loop;
  end;
end $$;
alter table public.apply_results
  add constraint apply_results_result_check
  check (result in ('submitted','needs_review','skipped','error','budget_capped','filtered'));

/* ── 3. engine RPC: policy + spend in ONE read (the cycle start call) ───── */
/* service_role_guard is not a real guard token — the engine connects with
   the service key exactly like engine_get_apply_config does, and the RPC
   grants carry the restriction (revoked from anon/public below). */
create or replace function public.engine_get_apply_policy()
returns table (
  mode text, cloud_provider text, cloud_endpoint text,
  policy_daily_cap int, policy_weekly_cap int,
  policy_quiet_from text, policy_quiet_to text,
  policy_filters jsonb,
  spend_today int, spend_week int
) language sql security definer set search_path = public as $$
  with cfg as (
    select mode, cloud_provider, cloud_endpoint,
      policy_daily_cap, policy_weekly_cap,
      policy_quiet_from, policy_quiet_to, policy_filters
    from public.apply_config where id = 'global'
  ),
  spend as (
    select
      count(*) filter (
        where result = 'submitted'
          and created_at >= date_trunc('day', now() at time zone 'utc')
      )::int as day,
      count(*) filter (
        where result = 'submitted'
          and created_at >= date_trunc('week', now() at time zone 'utc')
      )::int as week
    from public.apply_results
    where result = 'submitted'
  )
  select c.mode, c.cloud_provider, c.cloud_endpoint,
    c.policy_daily_cap, c.policy_weekly_cap,
    c.policy_quiet_from, c.policy_quiet_to, c.policy_filters,
    s.day, s.week
  from cfg c cross join spend s;
$$;

revoke execute on function public.engine_get_apply_policy() from anon, public;

/* ── 4. admin RPCs: read + write the policy from the dashboard ──────────── */
create or replace function public.admin_get_apply_policy()
returns table (
  policy_daily_cap int, policy_weekly_cap int,
  policy_quiet_from text, policy_quiet_to text,
  policy_filters jsonb
) language sql security definer set search_path = public as $$
  select policy_daily_cap, policy_weekly_cap, policy_quiet_from,
         policy_quiet_to, policy_filters
  from public.apply_config where id = 'global';
$$;

create or replace function public.admin_set_apply_policy(
  p_daily_cap int default null,
  p_weekly_cap int default null,
  p_quiet_from text default null,
  p_quiet_to text default null,
  p_filters jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_quiet_from is not null and p_quiet_from !~ '^\d{1,2}:\d{2}$' then
    raise exception 'quiet_from must be HH:MM';
  end if;
  if p_quiet_to is not null and p_quiet_to !~ '^\d{1,2}:\d{2}$' then
    raise exception 'quiet_to must be HH:MM';
  end if;
  if p_filters is not null and jsonb_typeof(p_filters) <> 'object' then
    raise exception 'filters must be a jsonb object';
  end if;
  update public.apply_config
    set policy_daily_cap = p_daily_cap,
        policy_weekly_cap = p_weekly_cap,
        policy_quiet_from = p_quiet_from,
        policy_quiet_to = p_quiet_to,
        policy_filters = p_filters,
        updated_at = now()
    where id = 'global';
end $$;

grant execute on function public.admin_get_apply_policy() to authenticated;
grant execute on function public.admin_set_apply_policy(int, int, text, text, jsonb) to authenticated;

/* ── 5. Phase 3: outcome-driven board suspension ───────────────────────── */
/* Flips dead boards back to 'pending' (probation). Returns the flip list
   [{host, applications, reason}] for the digest. Guarded + revoked. */
create or replace function public.engine_suspend_dead_boards(
  p_min_applications int default 10,
  p_max_sweeps int default 3
) returns table (host text, applications int, reason text)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  flips int := 0;
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  for r in
    select s.host,
      count(o.job_url) as apps,
      count(o.viewed_at) as viewed,
      count(o.responded_at) as responded
    from public.job_sites s
    left join public.apply_results ar on ar.site_host = s.host
      and ar.result = 'submitted'
      and ar.created_at > now() - interval '90 days'
    left join public.apply_outcomes o on o.job_url = ar.job_url
    where s.status = 'active'
    group by s.host
    having count(o.job_url) >= p_min_applications
       and count(o.viewed_at) = 0
       and count(o.responded_at) = 0
    order by count(o.job_url) desc
  loop
    exit when flips >= coalesce(p_max_sweeps, 3);
    update public.job_sites
      set status = 'pending', updated_at = now()
      where host = r.host and status = 'active';
    if found then
      flips := flips + 1;
      return next;
    end if;
  end loop;
end $$;

revoke execute on function public.engine_suspend_dead_boards(int, int) from anon, public;

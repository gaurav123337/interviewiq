/* apply-outcomes — the engine learns from EMPLOYER behavior, not only from
   the owner's verdicts. The weekly outcome scraper (--outcomes) reads each
   board's own application tracker (LinkedIn "My Jobs → Applied", Naukri
   "My applications", …) and records, per submitted application, whether the
   employer VIEWED it and/or RESPONDED (reply / interview / rejected / offer).
   The weekly digest then reports views+responses per BOARD and per FIT BAND
   so the owner sees which boards and which fit bands actually earn responses
   — and the engine feeds the same rates back into the AI judge as a prior.

   fit_band is derived from apply_results.fit by fit_band_of() in SQL so the
   scraper, the digest and the engine's learning stats always agree. */

create table if not exists public.apply_outcomes (
  id uuid primary key default gen_random_uuid(),
  site_host text not null,
  job_url text not null unique,
  fit int,
  fit_band text not null default 'unknown',
  viewed_at timestamptz,
  responded_at timestamptz,
  response_kind text check (response_kind in ('reply', 'interview', 'rejected', 'offer')),
  detail text,
  scraped_at timestamptz default now()
);

create index if not exists apply_outcomes_board_idx on public.apply_outcomes (site_host, scraped_at desc);
create index if not exists apply_outcomes_band_idx on public.apply_outcomes (fit_band, scraped_at desc);

alter table public.apply_outcomes enable row level security;

drop policy if exists apply_outcomes_admin on public.apply_outcomes;
create policy apply_outcomes_admin on public.apply_outcomes
  for all to authenticated
  using (public.is_job_sites_admin())
  with check (public.is_job_sites_admin());

/* the fit bands used everywhere (digest + engine learning) */
create or replace function public.fit_band_of(fit int)
returns text language sql immutable as $$
  select case
    when fit is null then 'unknown'
    when fit >= 85 then '85+'
    when fit >= 70 then '70-84'
    when fit >= 50 then '50-69'
    else '<50'
  end;
$$;

/* engine records one scraped milestone (service role or admin). Upsert by
   job_url: first VIEW wins, first RESPONSE wins, freshest fit/detail wins. */
create or replace function public.engine_record_apply_outcome(
  p_site_host text, p_job_url text, p_fit int default null,
  p_viewed boolean default false, p_response_kind text default null, p_detail text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_response_kind is not null and p_response_kind not in ('reply', 'interview', 'rejected', 'offer') then
    raise exception 'bad response_kind';
  end if;
  insert into public.apply_outcomes (site_host, job_url, fit, fit_band, viewed_at, responded_at, response_kind, detail)
  values (
    p_site_host, p_job_url, p_fit, public.fit_band_of(p_fit),
    case when p_viewed then now() end,
    case when p_response_kind is not null then now() end,
    p_response_kind, p_detail
  )
  on conflict (job_url) do update set
    viewed_at = coalesce(public.apply_outcomes.viewed_at, case when excluded.viewed_at is not null then now() end),
    responded_at = coalesce(public.apply_outcomes.responded_at, case when excluded.responded_at is not null then now() end),
    response_kind = coalesce(public.apply_outcomes.response_kind, excluded.response_kind),
    fit = coalesce(excluded.fit, public.apply_outcomes.fit),
    fit_band = public.fit_band_of(coalesce(excluded.fit, public.apply_outcomes.fit)),
    detail = coalesce(excluded.detail, public.apply_outcomes.detail),
    scraped_at = now();
end $$;

revoke execute on function public.engine_record_apply_outcome(text, text, int, boolean, text, text) from anon, public;

/* weekly digest per board × fit band: applications submitted in the last 7d
   (joined with any outcome scraped so far) — honest: many fresh applications
   have no milestone yet, and the row shows that as 0 viewed / 0 responded. */
create or replace function public.admin_apply_outcome_digest()
returns table (
  site_host text, fit_band text,
  applications int, viewed int, responded int,
  rejected int, interviews int
) language sql security definer set search_path = public as $$
  select r.site_host,
    public.fit_band_of(r.fit) as fit_band,
    count(*)::int as applications,
    count(o.viewed_at)::int as viewed,
    count(o.responded_at)::int as responded,
    count(*) filter (where o.response_kind = 'rejected')::int as rejected,
    count(*) filter (where o.response_kind in ('interview', 'offer'))::int as interviews
  from public.apply_results r
  left join public.apply_outcomes o on o.job_url = r.job_url
  where r.result = 'submitted'
    and r.created_at > now() - interval '7 days'
  group by r.site_host, public.fit_band_of(r.fit)
  order by r.site_host, public.fit_band_of(r.fit);
$$;

revoke execute on function public.admin_apply_outcome_digest() from anon, public;

/* the engine's learning stats: response rates per fit band over the last 90
   days (board-agnostic — the bands generalize, single-board rows don't).
   judgeMessages folds this into the AI judge prompt as an employer-behavior
   prior, so the judge learns which fit bands this profile's applications
   actually convert on. */
create or replace function public.engine_outcome_stats()
returns table (
  fit_band text, applications int, viewed int, responded int,
  response_rate numeric
) language sql security definer set search_path = public as $$
  select b.fit_band,
    count(r.job_url)::int as applications,
    count(o.viewed_at)::int as viewed,
    count(o.responded_at)::int as responded,
    round(count(o.responded_at)::numeric / greatest(count(r.job_url), 1), 3) as response_rate
  from (values ('85+'), ('70-84'), ('50-69'), ('<50')) as b(fit_band)
  left join public.apply_results r
    on public.fit_band_of(r.fit) = b.fit_band
   and r.result = 'submitted'
   and r.created_at > now() - interval '90 days'
  left join public.apply_outcomes o on o.job_url = r.job_url
  group by b.fit_band
  order by b.fit_band;
$$;

revoke execute on function public.engine_outcome_stats() from anon, public;

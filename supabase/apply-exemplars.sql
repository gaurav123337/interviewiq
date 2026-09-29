/* #123 — the judge's training set: short exemplars distilled from the
   owner's verdicts on REAL postings (and hand-seeded confirmations).
   Positive = "this looked like a match"; negative = "this never was".
   The judge prompt carries up to 5 of each, so future verdicts generalize
   from the owner's actual taste instead of pure heuristics. */

create table if not exists public.judge_exemplars (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('positive','negative')),
  summary text not null,             -- "Senior Frontend Developer @ LinkedIn — React/TS/Design Systems"
  reason text,                        -- why (owner note or distilled verdict)
  source_url text,
  created_at timestamptz default now()
);

alter table public.judge_exemplars enable row level security;

drop policy if exists judge_exemplars_admin on public.judge_exemplars;
create policy judge_exemplars_admin on public.judge_exemplars
  for all to authenticated
  using (public.is_job_sites_admin())
  with check (public.is_job_sites_admin());

/* admin upserts an exemplar (service role allowed: owner seeding tooling).
   NOTE: no unique dedupe index — duplicate summaries are acceptable and
   the judge prompt caps exemplars anyway. */
create or replace function public.admin_put_judge_exemplar(
  p_kind text, p_summary text, p_reason text default null, p_source_url text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_kind not in ('positive','negative') then raise exception 'bad kind'; end if;
  insert into public.judge_exemplars (kind, summary, reason, source_url)
  values (p_kind, left(trim(p_summary), 200), nullif(left(trim(coalesce(p_reason, '')), 300), ''), nullif(p_source_url, ''));
end $$;

create unique index if not exists judge_exemplars_dedupe_idx
  on public.judge_exemplars (kind, left(lower(summary), 200));

/* engine + admin read the latest 5 of each kind */
create or replace function public.engine_get_judge_exemplars()
returns table (kind text, summary text, reason text) language sql security definer set search_path = public as $$
  select kind, summary, reason from (
    select kind, summary, reason, created_at,
      row_number() over (partition by kind order by created_at desc) rn
    from public.judge_exemplars
  ) t where rn <= 5 order by kind, rn;
$$;

revoke execute on function public.admin_put_judge_exemplar(text, text, text, text) from anon, public;
grant execute on function public.admin_put_judge_exemplar(text, text, text, text) to authenticated;

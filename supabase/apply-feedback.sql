/* #122 — owner feedback loop: 👍/👎 on report rows teaches the gate.
   A 👎 on an applied job promotes its missing-core skills to LEARNED
   criticals (2 strikes = auto-reject whenever a JD requires them); a 👍
   clears strikes (a mistaken 👎, or the owner changed direction). */

alter table public.apply_results add column if not exists feedback text;

/* one row per (site_host, skill) — strikes accumulate across boards */
create table if not exists public.apply_skill_strikes (
  site_host text not null,          -- 'global' = learned across all boards
  skill text not null,
  strikes int not null default 0,
  updated_at timestamptz default now(),
  unique (site_host, skill)
);

alter table public.apply_skill_strikes enable row level security;

drop policy if exists apply_skill_strikes_admin on public.apply_skill_strikes;
create policy apply_skill_strikes_admin on public.apply_skill_strikes
  for all to authenticated
  using (public.is_job_sites_admin())
  with check (public.is_job_sites_admin());

/* owner feedback: verdict ∈ good|bad. bad → +1 strike per missing-core
   skill of that row (read from the row's detail is unreliable, so the
   caller passes the skills); good → clear strikes for those skills.
   Returns the resulting strike counts. */
create or replace function public.engine_apply_feedback(
  p_result_id uuid, p_verdict text, p_skills text[] default null
) returns table (skill text, strikes int) language plpgsql security definer set search_path = public as $$
declare
  v_site text;
  v_job_url text;
  s text;
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_verdict not in ('good','bad') then raise exception 'bad verdict'; end if;

  update public.apply_results set feedback = p_verdict where id = p_result_id;
  if not found then raise exception 'result row not found'; end if;

  select site_host into v_site from public.apply_results where id = p_result_id;
  if p_verdict = 'bad' then
    foreach s in array coalesce(p_skills, '{}') loop
      insert into public.apply_skill_strikes (site_host, skill, strikes)
      values ('global', lower(trim(s)), 1)
      on conflict (site_host, skill) do update
        set strikes = apply_skill_strikes.strikes + 1, updated_at = now();
    end loop;
  else
    foreach s in array coalesce(p_skills, '{}') loop
      delete from public.apply_skill_strikes
      where site_host = 'global' and skill = lower(trim(s));
    end loop;
  end if;

  return query select k.skill, k.strikes from public.apply_skill_strikes k
    where k.site_host = 'global' order by k.strikes desc, k.skill;
end $$;

/* engine reads learned criticals before gating (>=2 strikes = hard skill) */
create or replace function public.engine_get_skill_strikes(p_min int default 2)
returns table (skill text, strikes int) language sql security definer set search_path = public as $$
  select skill, strikes from public.apply_skill_strikes
  where site_host = 'global' and strikes >= p_min
  order by strikes desc;
$$;

/* UI: what has the engine learned so far */
create or replace function public.admin_get_skill_strikes()
returns table (skill text, strikes int) language sql security definer set search_path = public as $$
  select skill, strikes from public.apply_skill_strikes
  where site_host = 'global' order by strikes desc, skill;
$$;

revoke execute on function public.engine_apply_feedback(uuid, text, text[]) from anon, public;
revoke execute on function public.engine_get_skill_strikes(int) from anon, public;
grant execute on function public.admin_get_skill_strikes() to authenticated;

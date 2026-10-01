/* #163 — per-site session lifecycle state. The binary session_ok badge could
   not distinguish "never signed in" from "verified last week" from "expired
   yesterday", and nothing on the machine noticed when a stored session died
   server-side. The --sessions watchdog now stamps a three-state verdict +
   check time here, and the app renders it; a NEW expiry pings the owner. */

alter table public.job_sites
  add column if not exists session_state text default 'unknown',
  add column if not exists session_checked_at timestamptz,
  add column if not exists session_expired_at timestamptz;

/* Watchdog writes (engine runs as service_role or the admin user). States:
   unknown  — never probed (fresh registry row)
   verified — a fresh headless probe landed on a signed-in state
   expired  — the probe hit the login wall (session died server-side) */
create or replace function public.admin_set_site_session_state(p_host text, p_state text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_state not in ('unknown','verified','expired') then raise exception 'bad state'; end if;
  update public.job_sites set
    session_state = p_state,
    session_checked_at = now(),
    session_expired_at = case when p_state = 'expired' then now() else session_expired_at end,
    session_ok = case when p_state = 'expired' then false
                      when p_state = 'verified' then true
                      else session_ok end,
    updated_at = now()
  where host = lower(trim(p_host));
end $$;

revoke execute on function public.admin_set_site_session_state(text, text) from anon, public;
grant execute on function public.admin_set_site_session_state(text, text) to authenticated, service_role;

/* the list RPC now carries the three-state verdict + timestamps
   (return-type change: postgres cannot alter a table function in-place) */
drop function if exists public.admin_list_job_sites();
create function public.admin_list_job_sites()
returns table (
  id uuid, host text, label text, jobs_url text, status text, source text,
  rules jsonb, session_ok boolean, last_run_at timestamptz,
  last_submitted int, last_collected int, last_ok boolean,
  session_state text, session_checked_at timestamptz, session_expired_at timestamptz
) language sql security definer set search_path = public as $$
  select s.id, s.host, s.label, s.jobs_url, s.status, s.source,
         s.rules, s.session_ok, s.last_run_at,
         coalesce((s.last_result ->> 'submitted')::int, 0),
         coalesce((s.last_result ->> 'collected')::int, 0),
         coalesce((s.last_result ->> 'ok')::boolean, false),
         s.session_state, s.session_checked_at, s.session_expired_at
  from public.job_sites s
  order by (s.status = 'active') desc, s.host;
$$;

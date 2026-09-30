/* #150 — sign-in lifecycle visibility. Until now the app went dark after the
   🔑 click: the listener opened the sign-in window (or it crashed) and the
   admin only found out by staring at the session badge. The engine now
   reports each transition; this extends login_requests with the lifecycle
   state the app reads back. */

alter table public.login_requests
  add column if not exists status text default 'requested',
  add column if not exists detail text,
  add column if not exists opened_at timestamptz,
  add column if not exists closed_at timestamptz;

/* The engine reports every transition of the spawned --login-only run.
   opened:    the window actually launched (clone ready, browser up)
   crashed:   the login-only run died before producing a window or mid-flow
   verified:  session cookie confirmed present after the window closed
   failed:    window closed without a completed sign-in (missed / closed early)
   The host is upserted so a report for an expired/purged row still lands. */
create or replace function public.engine_report_login_status(p_host text, p_status text, p_detail text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.login_requests (host, status, detail, opened_at, closed_at)
  values (
    lower(trim(p_host)), lower(trim(p_status)), left(p_detail, 400),
    case when lower(trim(p_status)) = 'opened' then now() end,
    case when lower(trim(p_status)) in ('verified','failed','crashed') then now() end
  )
  on conflict (host) do update set
    status = excluded.status,
    detail = excluded.detail,
    opened_at = coalesce(login_requests.opened_at, excluded.opened_at),
    closed_at = excluded.closed_at;
end $$;

/* App-readable: the current sign-in lifecycle row for a host (admin only). */
create or replace function public.admin_login_status(p_host text)
returns table (host text, status text, detail text, opened_at timestamptz, closed_at timestamptz, requested_at timestamptz)
language sql security definer set search_path = public as $$
  select host, status, detail, opened_at, closed_at, requested_at
  from public.login_requests
  where host = lower(trim(p_host));
$$;

revoke execute on function public.engine_report_login_status(text, text, text) from anon, public, authenticated;
grant execute on function public.engine_report_login_status(text, text, text) to service_role;
revoke execute on function public.admin_login_status(text) from anon, public;
grant execute on function public.admin_login_status(text) to authenticated;

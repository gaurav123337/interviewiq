/* #139 — "use my Google auth here": Google blocks typed automation, so the
   flow is HUMAN-signs-in-once in the engine's own window. This table is the
   bridge from the APP to that window: the admin clicks 🔑 Sign in on a site
   row → a request row lands here → the running Telegram listener (desktop
   side) spawns `--login-only` for that host within ~30s → the owner completes
   Google/OTP in the opened window → the session persists in the engine
   profile forever. */

create table if not exists public.login_requests (
  host text primary key,
  requested_at timestamptz default now(),
  fulfilled_at timestamptz
);

alter table public.login_requests enable row level security;

create or replace function public.admin_request_login(p_host text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.login_requests (host) values (lower(trim(p_host)))
  on conflict (host) do update set requested_at = now(), fulfilled_at = null;
  return lower(trim(p_host)) || ' sign-in requested';
end $$;

create or replace function public.engine_pending_login_request()
returns table (host text, jobs_url text)
language sql security definer set search_path = public as $$
  select r.host, s.jobs_url
  from public.login_requests r
  left join public.job_sites s on s.host = r.host
  where r.fulfilled_at is null and r.requested_at > now() - interval '1 hour'
  order by r.requested_at
  limit 1;
$$;

create or replace function public.engine_fulfill_login_request(p_host text)
returns void language sql security definer set search_path = public as $$
  update public.login_requests set fulfilled_at = now() where host = lower(trim(p_host));
$$;

revoke execute on function public.admin_request_login(text) from anon, public;
revoke execute on function public.engine_pending_login_request() from anon, public, authenticated;
revoke execute on function public.engine_fulfill_login_request(text) from anon, public, authenticated;
grant execute on function public.admin_request_login(text) to authenticated;
grant execute on function public.engine_pending_login_request() to service_role;
grant execute on function public.engine_fulfill_login_request(text) to service_role;

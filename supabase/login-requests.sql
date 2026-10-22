/* #139 — "use my Google auth here": Google blocks typed automation, so the
   flow is HUMAN-signs-in-once in the engine's own window. This table is the
   bridge from the APP to that window: the admin clicks 🔑 Sign in on a site
   row → a request row lands here → the running Telegram listener (desktop
   side) spawns `--login-only` for that host within ~30s → the owner completes
   Google/OTP in the opened window → the session persists in the engine
   profile forever.

   kind (2026-10-22): 'signin' (🔑, the original flow) or 'view' (👁 proof
   — open the site LOGGED IN over the engine's saved session so the owner
   can SEE the signed-in page behind a "session verified" badge; that
   verdict is an engine-profile probe sharing no cookies with the owner's
   normal browser, so only a window from the profile itself proves it). */

create table if not exists public.login_requests (
  host text primary key,
  requested_at timestamptz default now(),
  fulfilled_at timestamptz
);

alter table public.login_requests
  add column if not exists kind text default 'signin';

alter table public.login_requests enable row level security;

create or replace function public.admin_request_login(p_host text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.login_requests (host) values (lower(trim(p_host)))
  on conflict (host) do update set requested_at = now(), fulfilled_at = null;
  return lower(trim(p_host)) || ' sign-in requested';
end $$;

/* Widen the pending-request read to carry kind ('signin'|'view'). Return
   type change → drop + recreate (same approach as admin_list_job_sites in
   #163; coalesce keeps legacy rows without kind reading as 'signin'). */
drop function if exists public.engine_pending_login_request();
create or replace function public.engine_pending_login_request(p_kind text default 'signin')
returns table (host text, jobs_url text, kind text)
language sql security definer set search_path = public as $$
  select r.host, s.jobs_url, coalesce(r.kind, p_kind) as kind
  from public.login_requests r
  left join public.job_sites s on s.host = r.host
  where r.fulfilled_at is null and r.requested_at > now() - interval '1 hour'
    and (p_kind = 'signin' or r.kind = p_kind or r.kind is null)
  order by r.requested_at
  limit 1;
$$;

create or replace function public.engine_fulfill_login_request(p_host text)
returns void language sql security definer set search_path = public as $$
  update public.login_requests set fulfilled_at = now() where host = lower(trim(p_host));
$$;

/* kind-aware overload (the original (text) overload stays — DPI-safe for
   app versions queued between SQL apply and deploy). */
create or replace function public.admin_request_login(p_host text, p_kind text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.login_requests (host, kind) values (lower(trim(p_host)), lower(trim(p_kind)))
  on conflict (host) do update set requested_at = now(), fulfilled_at = null, kind = excluded.kind;
  return lower(trim(p_host)) || ' ' || lower(trim(p_kind)) || ' requested';
end $$;

revoke execute on function public.admin_request_login(text) from anon, public;
revoke execute on function public.admin_request_login(text, text) from anon, public;
revoke execute on function public.engine_pending_login_request() from anon, public, authenticated;
revoke execute on function public.engine_fulfill_login_request(text) from anon, public, authenticated;
grant execute on function public.admin_request_login(text) to authenticated;
grant execute on function public.admin_request_login(text, text) to authenticated;
grant execute on function public.engine_pending_login_request() to service_role;
grant execute on function public.engine_fulfill_login_request(text) to service_role;

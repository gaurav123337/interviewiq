/* #152 — "⚡ Run now" from the UI. Same bridge as the 🔑 sign-in flow: the
   app queues a run request, the desktop Telegram listener polls for it and
   spawns `--all` (every ACTIVE site), then reports lifecycle back so the
   button shows queued → running → done-with-summary instead of nothing.
   Singleton row: one desktop engine, one run at a time. */

create table if not exists public.run_requests (
  key text primary key default 'singleton' check (key = 'singleton'),
  requested_at timestamptz default now(),
  fulfilled_at timestamptz,
  status text default 'requested',
  detail text
);

insert into public.run_requests (key) values ('singleton') on conflict do nothing;

alter table public.run_requests enable row level security;

/* App click: arm the singleton (never clobbers a pending/running request). */
create or replace function public.admin_request_run()
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.run_requests (key, requested_at, fulfilled_at, status, detail)
  values ('singleton', now(), null, 'requested', null)
  on conflict (key) do update set
    requested_at = now(), fulfilled_at = null, status = 'requested', detail = null
    where public.run_requests.fulfilled_at is not null;
  return 'run requested — the desktop engine starts it within ~30s';
end $$;

/* The listener's pending run request (unfulfilled, fresh). */
create or replace function public.engine_pending_run_request()
returns table (requested_at timestamptz)
language sql security definer set search_path = public as $$
  select requested_at from public.run_requests
  where key = 'singleton' and fulfilled_at is null
    and requested_at > now() - interval '1 hour';
$$;

/* The listener spawned the run. */
create or replace function public.engine_fulfill_run_request()
returns void language sql security definer set search_path = public as $$
  update public.run_requests set fulfilled_at = now() where key = 'singleton';
$$;

/* Lifecycle: started (spawn) / done (summary counts) / failed (exit code). */
create or replace function public.engine_report_run_status(p_status text, p_detail text)
returns void language sql security definer set search_path = public as $$
  update public.run_requests
  set status = lower(trim(p_status)), detail = left(p_detail, 400)
  where key = 'singleton';
$$;

/* App-readable lifecycle for the ⚡ button. */
create or replace function public.admin_run_status()
returns table (status text, detail text, requested_at timestamptz, fulfilled_at timestamptz)
language sql security definer set search_path = public as $$
  select status, detail, requested_at, fulfilled_at from public.run_requests where key = 'singleton';
$$;

revoke execute on function public.engine_pending_run_request() from anon, public, authenticated;
revoke execute on function public.engine_fulfill_run_request() from anon, public, authenticated;
revoke execute on function public.engine_report_run_status(text, text) from anon, public, authenticated;
revoke execute on function public.admin_request_run() from anon, public;
revoke execute on function public.admin_run_status() from anon, public;
grant execute on function public.engine_pending_run_request() to service_role;
grant execute on function public.engine_fulfill_run_request() to service_role;
grant execute on function public.engine_report_run_status(text, text) to service_role;
grant execute on function public.admin_request_run() to authenticated;
grant execute on function public.admin_run_status() to authenticated;

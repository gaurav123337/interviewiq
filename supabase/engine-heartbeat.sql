/* #156 — live engine state for the app. The local engine used to be a black
   box: the owner had no way to see whether anything was actually running on
   their machine. The listener now beats every ~2 min (running) and reports
   "stopped" when the Off switch kills it; a STALE beat reads as stopped, so
   a crashed listener can never look alive. Singleton row, same shape as the
   run-requests bridge. */

create table if not exists public.engine_state (
  key text primary key default 'singleton' check (key = 'singleton'),
  state text default 'stopped',
  detail text,
  beat_at timestamptz default now()
);

insert into public.engine_state (key) values ('singleton') on conflict do nothing;

alter table public.engine_state enable row level security;

/* The listener reports running (heartbeat) / stopped (Off kill). */
create or replace function public.engine_report_engine_state(p_state text, p_detail text)
returns void language sql security definer set search_path = public as $$
  update public.engine_state
  set state = lower(trim(p_state)), detail = left(p_detail, 300), beat_at = now()
  where key = 'singleton';
$$;

/* App-readable engine state (the 🟢 running / 🔴 stopped badge). */
create or replace function public.admin_engine_state()
returns table (state text, detail text, beat_at timestamptz)
language sql security definer set search_path = public as $$
  select state, detail, beat_at from public.engine_state where key = 'singleton';
$$;

revoke execute on function public.engine_report_engine_state(text, text) from anon, public, authenticated;
grant execute on function public.engine_report_engine_state(text, text) to service_role;
revoke execute on function public.admin_engine_state() from anon, public;
grant execute on function public.admin_engine_state() to authenticated;

/* #157 — engine activity timeline. The singleton engine_state row only shows
   NOW; the owner also wants to know WHEN the engine ran over the last day.
   Every state report (the ~2-min heartbeat + the Off-kill "stopped") is now
   also appended to an append-only history, pruned to 7 days on each write.
   The app groups the events into run sessions (gap > 6 min closes a session)
   and renders the 24h story under the badge. */

create table if not exists public.engine_events (
  id bigint generated always as identity primary key,
  state text not null,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.engine_events enable row level security;
-- no policies: only service_role (the engine) writes, only the security
-- definer RPC below reads — the table itself is fully sealed from clients.

/* Same contract as before for the singleton row, PLUS the history append. */
create or replace function public.engine_report_engine_state(p_state text, p_detail text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.engine_state
  set state = lower(trim(p_state)), detail = left(p_detail, 300), beat_at = now()
  where key = 'singleton';
  insert into public.engine_events (state, detail)
  values (lower(trim(p_state)), left(p_detail, 300));
  delete from public.engine_events where created_at < now() - interval '7 days';
end $$;

/* App-readable event history (beats + stop reports), newest first.
   p_hours clamped to 1..72 so a bad caller cannot dump the table. */
create or replace function public.admin_engine_events(p_hours int default 24)
returns table (state text, detail text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select state, detail, created_at from public.engine_events
  where created_at > now() - make_interval(hours => greatest(1, least(72, coalesce(p_hours, 24))))
  order by created_at desc
  limit 800;
$$;

revoke execute on function public.engine_report_engine_state(text, text) from anon, public, authenticated;
grant execute on function public.engine_report_engine_state(text, text) to service_role;
revoke execute on function public.admin_engine_events(int) from anon, public;
grant execute on function public.admin_engine_events(int) to authenticated;

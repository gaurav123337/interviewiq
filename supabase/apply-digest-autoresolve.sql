/* #129 — close the loop: when the engine SUBMITS a posting that has a
   pending review row, that row resolves itself (done) — the queue must
   reflect reality, not pile up stale asks. */

drop function if exists public.engine_resolve_review_by_url(text, text);
create or replace function public.engine_resolve_review_by_url(p_job_url text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_status not in ('done', 'dismissed', 'closed') then raise exception 'bad status'; end if;
  update public.job_apply_reviews
    set status = p_status, resolved_at = now()
    where job_url = p_job_url and status = 'pending';
end $$;

revoke execute on function public.engine_resolve_review_by_url(text, text) from anon, public;

/* #129 — weekly digest per board: what the engine did and what the owner
   did with it, over the last 7 days. Response tracking (employer replies)
   is out of scope until an inbox source exists; this is decision truth. */
drop function if exists public.admin_apply_weekly_digest();
create or replace function public.admin_apply_weekly_digest()
returns table (
  site_host text,
  submitted int, needs_review int, skipped int, errors int,
  owner_applied int, owner_dismissed int, owner_closed int
) language sql security definer set search_path = public as $$
  select r.site_host,
    count(*) filter (where r.result = 'submitted')::int,
    count(*) filter (where r.result = 'needs_review')::int,
    count(*) filter (where r.result = 'skipped')::int,
    count(*) filter (where r.result = 'error')::int,
    0::int, 0::int, 0::int
  from public.apply_results r
  where r.created_at > now() - interval '7 days'
  group by r.site_host
  union all
  select v.site_host,
    0::int, 0::int, 0::int, 0::int,
    count(*) filter (where v.status = 'done')::int,
    count(*) filter (where v.status = 'dismissed')::int,
    count(*) filter (where v.status = 'closed')::int
  from public.job_apply_reviews v
  where v.resolved_at > now() - interval '7 days'
  group by v.site_host
  order by site_host;
$$;

revoke execute on function public.admin_apply_weekly_digest() from anon, public;

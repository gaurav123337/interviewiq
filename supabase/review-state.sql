/* #127 — the engine must honor the owner's review-queue verdicts:
   a row marked Applied/Dismissed in the UI makes the engine skip that
   posting forever (the local dedupe file only knows what the ENGINE did).
   Returns the latest non-pending status per job URL. */

drop function if exists public.engine_list_reviewed_urls();
create or replace function public.engine_list_reviewed_urls()
returns table (job_url text, review_status text) language sql security definer set search_path = public as $$
  select r.job_url, r.status
  from public.job_apply_reviews r
  join (
    select job_url, max(created_at) as latest
    from public.job_apply_reviews
    where status <> 'pending'
    group by job_url
  ) last on last.job_url = r.job_url and last.latest = r.created_at
  where r.status <> 'pending';
$$;

revoke execute on function public.engine_list_reviewed_urls() from anon, public;

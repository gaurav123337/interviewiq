/* #128 — once-only Telegram pings: the engine pings the owner when a
   review row is NEW, not on every rerun of a still-pending posting. */

create or replace function public.engine_has_pending_review(p_job_url text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.job_apply_reviews
    where job_url = p_job_url and status = 'pending'
  );
$$;

revoke execute on function public.engine_has_pending_review(text) from anon, public;

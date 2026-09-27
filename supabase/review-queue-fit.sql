/* #113 — fit score for review-queue items. The engine's skill gate computes
   matched/missing skill sets per job; fit = round(matched/(matched+missing)*100)
   (null = gate had no opinion). Lets the owner re-rank the queue by fit. */

alter table public.job_apply_reviews add column if not exists fit int;

/* 7-arg engine RPC (fit added; supabase cannot drop-in-replace changed signatures) */
drop function if exists public.engine_queue_job_review(text, text, text, text, text, text);
create or replace function public.engine_queue_job_review(
  p_site_host text, p_job_url text, p_title text, p_company text,
  p_form_url text, p_reason text, p_fit int default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  insert into public.job_apply_reviews (site_host, job_url, title, company, form_url, reason, fit)
  values (p_site_host, p_job_url, p_title, p_company, p_form_url, p_reason, p_fit)
  on conflict (site_host, job_url) do nothing;
end $$;

revoke execute on function public.engine_queue_job_review(text, text, text, text, text, text, int) from anon, public;

/* the admin list returns the fit for re-ranking */
drop function if exists public.admin_list_job_reviews();
create or replace function public.admin_list_job_reviews()
returns table (
  id uuid, site_host text, job_url text, title text, company text,
  form_url text, reason text, fit int, created_at timestamptz
) language sql security definer set search_path = public as $$
  select id, site_host, job_url, title, company, form_url, reason, fit, created_at
  from public.job_apply_reviews
  where status = 'pending'
  order by created_at desc
  limit 100;
$$;

/* "Applied by User" (and Dismissed/Closed) history for the review queue.
   #160's dedupe covered only status='pending'; resolutions were invisible —
   the owner wanted to SEE what they already applied. Same listing shape as
   admin_list_job_reviews: one row per posting (newest variant wins via
   review_posting_key), with fit + posted_age_h so the ⏱ filter and chips
   behave exactly like the pending list. status is returned so the panel can
   badge done vs dismissed vs closed. */

create or replace function public.admin_list_resolved_job_reviews()
returns table (
  id uuid, site_host text, job_url text, title text, company text,
  form_url text, reason text, fit int, form_fields jsonb,
  status text, resolved_at timestamptz, created_at timestamptz,
  posted_age_h int
) language sql security definer set search_path = public as $$
  select id, site_host, job_url, title, company, form_url, reason, fit, form_fields,
         status, resolved_at, created_at, posted_age_h
  from (
    select r.*,
           row_number() over (
             partition by public.review_posting_key(r.job_url)
             order by coalesce(r.resolved_at, r.created_at) desc, r.id desc
           ) as rn
    from public.job_apply_reviews r
    where r.status in ('done', 'dismissed', 'closed')
  ) ranked
  where rn = 1
  order by resolved_at desc
  limit 150;
$$;

revoke execute on function public.admin_list_resolved_job_reviews() from anon, public;
grant execute on function public.admin_list_resolved_job_reviews() to authenticated;

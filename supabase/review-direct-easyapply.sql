/* #128 — direct-to-Easy-Apply links for the review queue. LinkedIn's
   /jobs/view/<id>/ deep link renders the CTA-less public shell; the
   signed-in UI with the Easy Apply CTA lives at
   /jobs/search/?currentJobId=<id>. The queue stores that shape in
   form_url at queue time so "Open form" lands straight on the apply
   modal (the deep link stays in job_url for identity/dedupe). */

drop function if exists public.engine_queue_job_review(text, text, text, text, text, text, int, jsonb);
create or replace function public.engine_queue_job_review(
  p_site_host text, p_job_url text, p_title text, p_company text,
  p_form_url text, p_reason text, p_fit int default null, p_form_fields jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  /* form_url upgrade: LinkedIn deep links are rewritten to the signed-in
     jobs UI (currentJobId shape) which carries the real Easy Apply CTA */
  if p_form_url is null or p_form_url like '%linkedin.com/jobs/view/%' then
    p_form_url := regexp_replace(p_form_url, '(https://[^/]+/jobs/view/)(\d+).*$', 'https://www.linkedin.com/jobs/search/?currentJobId=\2');
  end if;
  insert into public.job_apply_reviews (site_host, job_url, title, company, form_url, reason, fit, form_fields)
  values (p_site_host, p_job_url, p_title, p_company, p_form_url, p_reason, p_fit, p_form_fields)
  on conflict (site_host, job_url) do nothing;
end $$;

revoke execute on function public.engine_queue_job_review(text, text, text, text, text, text, int, jsonb) from anon, public;

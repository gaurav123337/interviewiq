/* #131 — the queue must tell the truth on re-runs. A posting whose row
   already exists (dedupe by (site_host, job_url)) now REFRESHES the row's
   reason, fit and form-field preview instead of silently keeping the stale
   first impression — the owner sees the CURRENT state of the form. */

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
  on conflict (site_host, job_url) do update
    set reason      = excluded.reason,
        fit         = coalesce(excluded.fit, job_apply_reviews.fit),
        form_fields = coalesce(excluded.form_fields, job_apply_reviews.form_fields),
        title       = coalesce(excluded.title, job_apply_reviews.title),
        company     = coalesce(nullif(excluded.company, ''), job_apply_reviews.company);
end $$;

/* #168 — the report and review queue must show the POSTING's age, not the
   decision row's. The engine already parses each board's card age stamp at
   collect time (parsePostedAge → __ageH hours — the ONLY trusted source;
   ISO postedAt strings are never parsed) and its console lines show it
   ("Sr Frontend Engineer — iTCart (90d old)"), but nothing pushed it to the
   DB, so apply_results and job_apply_reviews only displayed how long ago
   the ENGINE decided (created_at → "22h ago"), indistinguishable from the
   posting's age. With the column, the UI shows the board's clock (" (90d
   old)") and the owner can filter the report by the same maxAgeDays
   semantics as the registry chip — unknown-age rows are NEVER hidden
   (fail-open; the review queue is where the owner rescues edge-cases). */

alter table public.apply_results
  add column if not exists posted_age_h int;

alter table public.job_apply_reviews
  add column if not exists posted_age_h int;

/* sane ages only — the column mirrors the lib's guard (maxAgeDaysOf's
   integer habit): negative/garbage never enters history */
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'apply_results_posted_age_h_check'
  ) then
    alter table public.apply_results
      add constraint apply_results_posted_age_h_check check (posted_age_h is null or posted_age_h >= 0);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_apply_reviews_posted_age_h_check'
  ) then
    alter table public.job_apply_reviews
      add constraint job_apply_reviews_posted_age_h_check check (posted_age_h is null or posted_age_h >= 0);
  end if;
end $$;

/* ── apply_results: engine RPC gains the posting age ───────────────────── */
create or replace function public.engine_record_apply_result(
  p_site_host text, p_job_url text, p_title text, p_company text,
  p_result text, p_detail text default null, p_fit int default null,
  p_posted_age_h int default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_result not in ('submitted','needs_review','skipped','error') then
    raise exception 'bad result';
  end if;
  if p_posted_age_h is not null and p_posted_age_h < 0 then
    raise exception 'bad posted age (hours) — must be >= 0';
  end if;
  insert into public.apply_results (site_host, job_url, title, company, result, detail, fit, posted_age_h)
  values (p_site_host, p_job_url, p_title, p_company, p_result, p_detail, p_fit, p_posted_age_h);
end $$;

/* the UI report: latest decisions first — now carrying the posting age.
   feedback is apply_results' own column (apply-feedback.sql), joined free. */
drop function if exists public.admin_list_apply_results(int);
create or replace function public.admin_list_apply_results(p_limit int default 100)
returns table (
  id uuid, site_host text, job_url text, title text, company text,
  result text, detail text, fit int, posted_age_h int, feedback text, created_at timestamptz
) language sql security definer set search_path = public as $$
  select id, site_host, job_url, title, company, result, detail, fit, posted_age_h, feedback, created_at
  from public.apply_results
  order by created_at desc
  limit least(greatest(p_limit, 1), 500);
$$;

/* ── review queue: engine RPC gains the posting age (refresh-on-rerun kept) ──
   NOTE: re-authoring the CURRENT live signature (fit + form_fields +
   posted_age_h), preserving its form_url upgrade and on-conflict refresh. */
create or replace function public.engine_queue_job_review(
  p_site_host text, p_job_url text, p_title text, p_company text,
  p_form_url text, p_reason text, p_fit int default null, p_form_fields jsonb default null,
  p_posted_age_h int default null
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
  if p_posted_age_h is not null and p_posted_age_h < 0 then
    raise exception 'bad posted age (hours) — must be >= 0';
  end if;
  insert into public.job_apply_reviews (site_host, job_url, title, company, form_url, reason, fit, form_fields, posted_age_h)
  values (p_site_host, p_job_url, p_title, p_company, p_form_url, p_reason, p_fit, p_form_fields, p_posted_age_h)
  on conflict (site_host, job_url) do update
    set reason        = excluded.reason,
        fit           = coalesce(excluded.fit, job_apply_reviews.fit),
        form_fields   = coalesce(excluded.form_fields, job_apply_reviews.form_fields),
        posted_age_h  = coalesce(excluded.posted_age_h, job_apply_reviews.posted_age_h),
        title         = coalesce(excluded.title, job_apply_reviews.title),
        company       = coalesce(nullif(excluded.company, ''), job_apply_reviews.company);
end $$;

/* admin list returns the posting age so the queue can show the chip */
drop function if exists public.admin_list_job_reviews();
create or replace function public.admin_list_job_reviews()
returns table (
  id uuid, site_host text, job_url text, title text, company text,
  form_url text, reason text, fit int, form_fields jsonb,
  posted_age_h int, created_at timestamptz
) language sql security definer set search_path = public as $$
  select id, site_host, job_url, title, company, form_url, reason, fit, form_fields, posted_age_h, created_at
  from public.job_apply_reviews
  where status = 'pending'
  order by created_at desc
  limit 100;
$$;

/* ── grants + revokes: same guard as the wider family ──────────────────── */
revoke execute on function public.engine_record_apply_result(text, text, text, text, text, text, int, int) from anon, public;
revoke execute on function public.engine_queue_job_review(text, text, text, text, text, text, int, jsonb, int) from anon, public;
grant execute on function public.admin_list_apply_results(int) to authenticated;
grant execute on function public.admin_list_job_reviews() to authenticated;

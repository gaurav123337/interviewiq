/* #115 — (1) form persistence: every answer the engine fills on any form is
   stored keyed (site_host, field_key) — field_key is the normalized field
   label — so the next form with the same label reuses the owner-confirmed
   answer. Drafted-from-profile answers are stored too (they are the profile's
   own facts). Kinds that must never be reused (coverLetter/longText/unknown/
   workAuth/certificate) are excluded engine-side before the write.

   (2) external-ATS review items carry a form_fields jsonb preview: every
   field with label/kind/required/answered, so the owner sees WHAT the engine
   answered before opening the form. Supabase cannot change an RPC signature
   in place — drop first (same as the fit migration). */

create table if not exists public.form_answers (
  id uuid primary key default gen_random_uuid(),
  site_host text not null,
  field_key text not null,
  answer text not null,
  kind text,
  label text,
  source text not null default 'engine' check (source in ('engine','manual')),
  updated_at timestamptz default now(),
  unique (site_host, field_key)
);

create index if not exists form_answers_site_idx on public.form_answers (site_host);

alter table public.form_answers enable row level security;

drop policy if exists form_answers_admin on public.form_answers;
create policy form_answers_admin on public.form_answers
  for all to authenticated
  using (public.is_job_sites_admin())
  with check (public.is_job_sites_admin());

/* engine upserts a field's answer (upsert so the freshest answer wins) */
create or replace function public.engine_put_form_answer(
  p_site_host text, p_field_key text, p_answer text,
  p_kind text default null, p_label text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  insert into public.form_answers (site_host, field_key, answer, kind, label, source)
  values (p_site_host, p_field_key, p_answer, p_kind, p_label, 'engine')
  on conflict (site_host, field_key) do update
    set answer = excluded.answer, kind = excluded.kind, label = excluded.label, updated_at = now();
end $$;

/* engine reads the answer memory for a site (one round-trip per form) */
create or replace function public.engine_get_form_answers(p_site_host text)
returns table (field_key text, answer text) language sql security definer set search_path = public as $$
  select field_key, answer from public.form_answers where site_host = p_site_host;
$$;

alter table public.job_apply_reviews add column if not exists form_fields jsonb;

/* 8-arg queue RPC: form_fields preview jsonb added (drop-first for the new signature) */
drop function if exists public.engine_queue_job_review(text, text, text, text, text, text, int);
create or replace function public.engine_queue_job_review(
  p_site_host text, p_job_url text, p_title text, p_company text,
  p_form_url text, p_reason text, p_fit int default null, p_form_fields jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  insert into public.job_apply_reviews (site_host, job_url, title, company, form_url, reason, fit, form_fields)
  values (p_site_host, p_job_url, p_title, p_company, p_form_url, p_reason, p_fit, p_form_fields)
  on conflict (site_host, job_url) do nothing;
end $$;

revoke execute on function public.engine_queue_job_review(text, text, text, text, text, text, int, jsonb) from anon, public;

/* admin list returns the preview for the panel */
drop function if exists public.admin_list_job_reviews();
create or replace function public.admin_list_job_reviews()
returns table (
  id uuid, site_host text, job_url text, title text, company text,
  form_url text, reason text, fit int, form_fields jsonb, created_at timestamptz
) language sql security definer set search_path = public as $$
  select id, site_host, job_url, title, company, form_url, reason, fit, form_fields, created_at
  from public.job_apply_reviews
  where status = 'pending'
  order by created_at desc
  limit 100;
$$;

revoke execute on function public.engine_get_form_answers(text) from anon, public;
revoke execute on function public.engine_put_form_answer(text, text, text, text, text) from anon, public;
grant execute on function public.admin_list_job_reviews() to authenticated;

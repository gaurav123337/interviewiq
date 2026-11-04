/* Phase 2 — human-in-the-loop TAILORED-RESUME variants (apply_resume_variants).
 *
 * Every LLM-tailored kit the engine builds is pushed here with a per-section
 * diff summary vs the master template + the JD keywords that justify each
 * change — the trust loop "tailored as per JD, and I can see/edit it".
 * Approval is the hour-audit counterpart of the engine's fail-closed
 * tailorSubmitGate: an unapproved variant holds auto-submit (driver-side,
 * pure lib pinned in applyKitTailor.test.ts). Owner-only via RLS like
 * apply_results; engine writes ride the service key (engine_* RPCs).
 *
 * IDEMPOTENT: safe to re-paste.
 */

create table if not exists public.apply_resume_variants (
  id uuid primary key default gen_random_uuid(),
  site_host text,
  job_url text not null,
  title text,
  company text,
  master_text text,          -- the deterministic template the AI rewrote
  variant_text text,         -- the LLM-authored resume the engine used
  diff_summary jsonb,        -- previewTailoredResume() output (sections + matchedKeywords)
  variant_id text not null,  -- content hash (apply-kit-lib.stableVariantId) — dedupe id
  approved boolean not null default false,
  created_at timestamptz default now(),
  approved_at timestamptz
);

create index if not exists apply_resume_variants_recent_idx
  on public.apply_resume_variants (created_at desc);

create unique index if not exists apply_resume_variants_dedupe_idx
  on public.apply_resume_variants (job_url, variant_id);

alter table public.apply_resume_variants enable row level security;

drop policy if exists apply_resume_variants_admin on public.apply_resume_variants;
create policy apply_resume_variants_admin on public.apply_resume_variants
  for all to authenticated
  using (public.is_job_sites_admin())
  with check (public.is_job_sites_admin());

/* ── engine write: upsert one tailored variant (same content = same row,
   approved state PRESERVED on re-push; changed content = new variant_id
   row that starts unapproved — tailoring drift must never inherit trust).
   Guarded like admin_put_judge_exemplar: is_admin() or the service role
   (the local engine holds the service key; anon gets nothing). */
create or replace function public.engine_put_resume_variant(
  p_job_url text, p_site_host text, p_title text, p_company text,
  p_master text, p_variant text, p_diff jsonb, p_variant_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  insert into public.apply_resume_variants
    (job_url, site_host, title, company, master_text, variant_text, diff_summary, variant_id)
  values
    (p_job_url, nullif(trim(p_site_host), ''), nullif(trim(p_title), ''), nullif(trim(p_company), ''),
     p_master, p_variant, p_diff, left(trim(p_variant_id), 64))
  on conflict (job_url, variant_id) do update
    set variant_text = excluded.variant_text,
        master_text  = excluded.master_text,
        diff_summary = excluded.diff_summary
  returning apply_resume_variants.id into v_id;
  return v_id;
end $$;

/* ── engine read: the NEWEST variant row for a job (any content) + whether
   the owner approved it — drives job.__variantApproved for the gate */
create or replace function public.engine_latest_resume_variant(
  p_job_url text
) returns table (id uuid, variant_id text, approved boolean, created_at timestamptz)
language sql security definer set search_path = public as $$
  select id, variant_id, approved, created_at
  from public.apply_resume_variants
  where job_url = p_job_url
  order by created_at desc, id desc
  limit 1;
$$;

/* ── the UI listing (newest first) ── */
create or replace function public.admin_list_resume_variants(p_limit int default 50)
returns table (
  id uuid, site_host text, job_url text, title text, company text,
  master_text text, variant_text text, diff_summary jsonb,
  variant_id text, approved boolean, created_at timestamptz, approved_at timestamptz
) language sql security definer set search_path = public as $$
  select id, site_host, job_url, title, company, master_text, variant_text, diff_summary,
         variant_id, approved, created_at, approved_at
  from public.apply_resume_variants
  order by created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

/* ── one-click approval + revert; approval applies to the ROW (one variant
   of one posting), so a later tailoring (different variant_id) asks again */
create or replace function public.admin_approve_resume_variant(
  p_id uuid, p_approved boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_job_sites_admin() then raise exception 'forbidden'; end if;
  update public.apply_resume_variants
  set approved = p_approved, approved_at = case when p_approved then now() else null end
  where id = p_id;
end $$;

revoke execute on function public.engine_put_resume_variant(text, text, text, text, text, text, jsonb, text) from anon, public;
revoke execute on function public.engine_latest_resume_variant(text) from anon, public;
revoke execute on function public.admin_approve_resume_variant(uuid, boolean) from anon, public;
grant execute on function public.admin_approve_resume_variant(uuid, boolean) to authenticated;
grant execute on function public.admin_list_resume_variants(int) to authenticated;

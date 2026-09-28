/* #117 — owner controls for the auto-apply engine + full per-job run report.

   apply_config: ONE global row ('global') the engine reads at every cycle
   start. 'off' is the kill switch — the engine skips the cycle honestly
   even when the watcher process is alive; 'local' is today's behavior;
   'cloud' requires cloud_endpoint (persistent CDP session, see
   docs/cloud-browser-research.md) and fails closed without one.

   apply_results: every per-job decision (submitted/needs_review/skipped/
   error) the engine records, so the UI can render the full report — not
   just the review-queue subset. Owner-only via RLS like the registry. */

create table if not exists public.apply_config (
  id text primary key default 'global' check (id = 'global'),
  mode text not null default 'off' check (mode in ('off','local','cloud')),
  cloud_provider text,
  cloud_endpoint text,
  updated_at timestamptz default now()
);

insert into public.apply_config (id, mode) values ('global', 'off')
  on conflict (id) do nothing;

alter table public.apply_config enable row level security;

drop policy if exists apply_config_admin on public.apply_config;
create policy apply_config_admin on public.apply_config
  for all to authenticated
  using (public.is_job_sites_admin())
  with check (public.is_job_sites_admin());

/* admin read/write from the UI */
create or replace function public.admin_get_apply_config()
returns table (mode text, cloud_provider text, cloud_endpoint text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select mode, cloud_provider, cloud_endpoint, updated_at from public.apply_config where id = 'global';
$$;

create or replace function public.admin_set_apply_config(
  p_mode text, p_cloud_provider text default null, p_cloud_endpoint text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_mode not in ('off','local','cloud') then raise exception 'bad mode'; end if;
  if p_mode = 'cloud' and coalesce(p_cloud_endpoint, '') = '' then
    raise exception 'cloud mode needs a CDP endpoint (see docs/cloud-browser-research.md)';
  end if;
  insert into public.apply_config (id, mode, cloud_provider, cloud_endpoint, updated_at)
  values ('global', p_mode, nullif(p_cloud_provider, ''), nullif(p_cloud_endpoint, ''), now())
  on conflict (id) do update
    set mode = excluded.mode, cloud_provider = excluded.cloud_provider,
        cloud_endpoint = excluded.cloud_endpoint, updated_at = now();
end $$;

/* engine reads the switch at every cycle start (service-role guarded) */
create or replace function public.engine_get_apply_config()
returns table (mode text, cloud_provider text, cloud_endpoint text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select mode, cloud_provider, cloud_endpoint, updated_at from public.apply_config where id = 'global';
$$;

/* ── per-job run report ────────────────────────────────────────────────── */

create table if not exists public.apply_results (
  id uuid primary key default gen_random_uuid(),
  site_host text not null,
  job_url text not null,
  title text,
  company text,
  result text not null check (result in ('submitted','needs_review','skipped','error')),
  detail text,
  fit int,
  created_at timestamptz default now()
);

create index if not exists apply_results_recent_idx
  on public.apply_results (created_at desc);

alter table public.apply_results enable row level security;

drop policy if exists apply_results_admin on public.apply_results;
create policy apply_results_admin on public.apply_results
  for all to authenticated
  using (public.is_job_sites_admin())
  with check (public.is_job_sites_admin());

/* engine pushes one result row per job decision (non-fatal, upsert-free:
   the engine dedupes jobs itself, history is the point) */
create or replace function public.engine_record_apply_result(
  p_site_host text, p_job_url text, p_title text, p_company text,
  p_result text, p_detail text default null, p_fit int default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_result not in ('submitted','needs_review','skipped','error') then
    raise exception 'bad result';
  end if;
  insert into public.apply_results (site_host, job_url, title, company, result, detail, fit)
  values (p_site_host, p_job_url, p_title, p_company, p_result, p_detail, p_fit);
end $$;

/* the UI report: latest decisions first */
create or replace function public.admin_list_apply_results(p_limit int default 100)
returns table (
  id uuid, site_host text, job_url text, title text, company text,
  result text, detail text, fit int, created_at timestamptz
) language sql security definer set search_path = public as $$
  select id, site_host, job_url, title, company, result, detail, fit, created_at
  from public.apply_results
  order by created_at desc
  limit least(greatest(p_limit, 1), 500);
$$;

/* ── grants ───────────────────────────────────────────────────────────── */
revoke execute on function public.engine_get_apply_config() from anon, public;
revoke execute on function public.engine_record_apply_result(text, text, text, text, text, text, int) from anon, public;
grant execute on function public.admin_get_apply_config() to authenticated;
grant execute on function public.admin_set_apply_config(text, text, text) to authenticated;
grant execute on function public.admin_list_apply_results(int) to authenticated;

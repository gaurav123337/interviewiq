/* job_apply_reviews — the review queue for review-gate jobs the engine could
   not submit unattended. In --unattended mode the engine skips those forms
   (never page.pause) and records them here with the form URL; the owner
   finishes them in one click from the UI. Also notify_config: where the
   engine sends the post-batch Telegram summary (optional; empty = disabled).
   Owner-only: RLS restricted to the single admin user; service role bypasses. */

create table if not exists public.job_apply_reviews (
  id uuid primary key default gen_random_uuid(),
  site_host text not null,
  job_url text not null,
  title text,
  company text,
  form_url text,
  status text not null default 'pending' check (status in ('pending','done','dismissed')),
  reason text,
  created_at timestamptz default now(),
  resolved_at timestamptz,
  unique (site_host, job_url)
);

create index if not exists job_apply_reviews_pending_idx
  on public.job_apply_reviews (status, created_at desc);

alter table public.job_apply_reviews enable row level security;

drop policy if exists job_apply_reviews_admin on public.job_apply_reviews;
create policy job_apply_reviews_admin on public.job_apply_reviews
  for all to authenticated
  using (public.is_job_sites_admin())
  with check (public.is_job_sites_admin());

/* optional Telegram delivery config for the engine's post-batch summary */
create table if not exists public.notify_config (
  key text primary key check (key in ('telegram')),
  chat_id text,
  bot_token text,
  updated_at timestamptz default now()
);

alter table public.notify_config enable row level security;

drop policy if exists notify_config_admin on public.notify_config;
create policy notify_config_admin on public.notify_config
  for all to authenticated
  using (public.is_job_sites_admin())
  with check (public.is_job_sites_admin());

/* ── engine RPCs (service-role or admin, same guard as the registry) ───── */

/* engine queues a review-gate job it skipped in unattended mode */
create or replace function public.engine_queue_job_review(
  p_site_host text, p_job_url text, p_title text, p_company text,
  p_form_url text, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  insert into public.job_apply_reviews (site_host, job_url, title, company, form_url, reason)
  values (p_site_host, p_job_url, p_title, p_company, p_form_url, p_reason)
  on conflict (site_host, job_url) do nothing;  -- never resurrect dismissed jobs
end $$;

/* ── admin RPCs (UI) ───────────────────────────────────────────────────── */

create or replace function public.admin_list_job_reviews()
returns table (
  id uuid, site_host text, job_url text, title text, company text,
  form_url text, reason text, created_at timestamptz
) language sql security definer set search_path = public as $$
  select id, site_host, job_url, title, company, form_url, reason, created_at
  from public.job_apply_reviews
  where status = 'pending'
  order by created_at desc
  limit 100;
$$;

create or replace function public.admin_resolve_job_review(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('done','dismissed') then raise exception 'bad status'; end if;
  update public.job_apply_reviews
    set status = p_status, resolved_at = now()
    where id = p_id;
end $$;

create or replace function public.admin_get_notify_config()
returns table (chat_id text, bot_token text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select chat_id, bot_token, updated_at from public.notify_config where key = 'telegram';
$$;

create or replace function public.admin_set_notify_config(p_chat_id text, p_bot_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.notify_config (key, chat_id, bot_token, updated_at)
  values ('telegram', nullif(p_chat_id, ''), nullif(p_bot_token, ''), now())
  on conflict (key) do update
    set chat_id = excluded.chat_id, bot_token = excluded.bot_token, updated_at = now();
end $$;

/* ── grants: lock everything down like the registry RPCs ───────────────── */

revoke execute on function public.engine_queue_job_review(text, text, text, text, text, text) from anon, public;
revoke execute on function public.admin_list_job_reviews() from anon, public;
revoke execute on function public.admin_resolve_job_review(uuid, text) from anon, public;
revoke execute on function public.admin_get_notify_config() from anon, public;
revoke execute on function public.admin_set_notify_config(text, text) from anon, public;
grant execute on function public.admin_list_job_reviews() to authenticated;
grant execute on function public.admin_resolve_job_review(uuid, text) to authenticated;
grant execute on function public.admin_get_notify_config() to authenticated;
grant execute on function public.admin_set_notify_config(text, text) to authenticated;

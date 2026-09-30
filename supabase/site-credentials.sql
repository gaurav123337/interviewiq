/* #138 — credentials from the app: the owner stores login credentials per
   site (or per GROUP — one credential can be bound to many sites that share
   the same auth, e.g. one Google account across instahyre + indeed), and
   the engine uses them to re-login when a saved session dies. Secrets live
   server-side (admin-only RLS); the UI shows prefixes only. Also:
   admin_add_job_site so the owner can add job URLs from the app itself. */

create table if not exists public.site_credentials (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  kind text not null default 'password' check (kind in ('password','oauth','otp','manual')),
  username text,
  secret text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.site_credentials enable row level security;

drop policy if exists "creds admin" on public.site_credentials;
create policy "creds admin" on public.site_credentials
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.job_sites add column if not exists credential_id uuid references public.site_credentials(id) on delete set null;

/* ── admin RPCs ── */
create or replace function public.admin_list_credentials()
returns table (id uuid, label text, kind text, username text, secret_prefix text, bound_sites text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, c.label, c.kind, c.username, left(coalesce(c.secret, ''), 2) as secret_prefix,
    coalesce((select string_agg(s.host, ', ' order by s.host) from public.job_sites s where s.credential_id = c.id), '') as bound_sites,
    c.updated_at
  from public.site_credentials c
  order by c.updated_at desc;
$$;

create or replace function public.admin_put_credential(
  p_id uuid, p_label text, p_kind text, p_username text, p_secret text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_kind not in ('password','oauth','otp','manual') then raise exception 'bad kind'; end if;
  if p_id is null then
    insert into public.site_credentials (label, kind, username, secret)
    values (left(trim(p_label), 80), p_kind, nullif(trim(coalesce(p_username,'')), ''), p_secret)
    returning id into v_id;
  else
    update public.site_credentials set
      label = left(trim(p_label), 80), kind = p_kind,
      username = nullif(trim(coalesce(p_username,'')), ''),
      secret = coalesce(p_secret, secret), updated_at = now()
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'not found'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_credential(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.site_credentials where id = p_id;
end $$;

/* bind (or unbind with null) a credential to a site — clubbing = the same
   credential_id on several hosts */
create or replace function public.admin_bind_credential(p_host text, p_credential_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.job_sites set credential_id = p_credential_id
  where host = lower(trim(p_host)) or host = lower(trim(p_host));
end $$;

/* ── engine read path (service-role only; returns the SECRET) ── */
create or replace function public.engine_credential_for_site(p_host text)
returns table (label text, kind text, username text, secret text)
language sql security definer set search_path = public as $$
  select c.label, c.kind, c.username, c.secret
  from public.job_sites s
  join public.site_credentials c on c.id = s.credential_id
  where s.host = lower(replace(trim(p_host), '^www\.', ''))
  limit 1;
$$;

/* ── add a job URL from the app: manual additions are DELIBERATE (not
      auto-discovered), so they register ACTIVE directly ── */
create or replace function public.admin_add_job_site(p_jobs_url text, p_label text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_host text; v_existing text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  v_host := lower(substring(p_jobs_url from '^https?://([^/]+)'));
  if v_host is null or v_host = '' then raise exception 'invalid URL'; end if;
  v_host := replace(v_host, '^www\.', '');
  select status into v_existing from public.job_sites where host = v_host;
  if v_existing is not null then
    if v_existing = 'disabled' or v_existing = 'dead' then
      update public.job_sites set status = 'active' where host = v_host;
      return v_host || ' re-activated';
    end if;
    return v_host || ' already registered (' || v_existing || ')';
  end if;
  insert into public.job_sites (host, label, jobs_url, status, source)
  values (v_host, coalesce(nullif(trim(p_label), ''), v_host), p_jobs_url, 'active', 'manual');
  return v_host || ' added and active';
end $$;

revoke execute on function public.admin_list_credentials() from anon, public;
revoke execute on function public.admin_put_credential(uuid, text, text, text, text) from anon, public;
revoke execute on function public.admin_delete_credential(uuid) from anon, public;
revoke execute on function public.admin_bind_credential(text, uuid) from anon, public;
revoke execute on function public.engine_credential_for_site(text) from anon, public, authenticated;
revoke execute on function public.admin_add_job_site(text, text) from anon, public;
grant execute on function public.admin_list_credentials() to authenticated;
grant execute on function public.admin_put_credential(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_delete_credential(uuid) to authenticated;
grant execute on function public.admin_bind_credential(text, uuid) to authenticated;
grant execute on function public.admin_add_job_site(text, text) to authenticated;
grant execute on function public.engine_credential_for_site(text) to service_role;

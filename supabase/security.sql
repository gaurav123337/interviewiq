-- InterviewIQ security schema (docs/app-security.md G8/G9 + §10) — run once
-- in the Supabase SQL editor (or via scripts/setup-security.js):
--   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/setup-security.js
--
-- Adds:
--   1. admin_audit — an append-only log of admin config/announcements/admin
--      changes, with an RPC the Admin dashboard reads.
--   2. MFA enforcement — is_admin_mfa_verified() requires the JWT's amr claim
--      to include 'totp' when admin_security.mfa is enabled in app_config.
--      The owner-only grant/revoke RPCs are re-gated on it (idempotent).
--   3. delete_my_account — a signed-in user deletes their own account;
--      billing rows are retained with identity removed (legal requirement).
--   4. admin_security_status — what the Admin dashboard banner shows.

/* ------------------------------------------------------------------ */
/* 1. Admin audit log                                                  */
/* ------------------------------------------------------------------ */

create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  actor text not null default '',
  action text not null,               -- create | update | delete | grant | revoke | send | rpc
  target text not null default '',    -- table name or action label
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);

alter table public.admin_audit enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_audit' and policyname = 'admin audit read') then
    create policy "admin audit read" on public.admin_audit for select using (public.is_admin());
  end if;
end $$;

create or replace function public.log_admin_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act text; tgt text; d jsonb; actor_email text;
begin
  actor_email := coalesce(nullif(auth.jwt() ->> 'email', ''), 'system');
  tgt := tg_table_name;
  if tg_op = 'INSERT' then act := 'create'; d := to_jsonb(new);
  elsif tg_op = 'UPDATE' then act := 'update'; d := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
  else act := 'delete'; d := to_jsonb(old); end if;
  insert into public.admin_audit (actor, action, target, meta)
  values (actor_email, act, tgt, jsonb_build_object('row', d));
  return coalesce(new, old);
end $$;

drop trigger if exists admin_audit_app_config on public.app_config;
create trigger admin_audit_app_config
  after insert or update or delete on public.app_config
  for each row execute function public.log_admin_audit();

drop trigger if exists admin_audit_announcements on public.announcements;
create trigger admin_audit_announcements
  after insert or update or delete on public.announcements
  for each row execute function public.log_admin_audit();

drop trigger if exists admin_audit_admins on public.app_admins;
create trigger admin_audit_admins
  after insert or update or delete on public.app_admins
  for each row execute function public.log_admin_audit();

create or replace function public.admin_audit_log(max_rows integer default 100)
returns table (actor text, action text, target text, meta jsonb, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select a.actor, a.action, a.target, a.meta, a.created_at
    from public.admin_audit a
    order by a.created_at desc
    limit greatest(1, least(coalesce(max_rows, 100), 500));
end $$;

/* ------------------------------------------------------------------ */
/* 2. MFA enforcement                                                  */
/* ------------------------------------------------------------------ */

/* Owner/admin + TOTP enrollment must be on (app_config → admin_security.mfa)
   before sensitive admin actions can REQUIRE it — so the owner can enroll
   first, then flip the switch. Default: not enforced (nothing locks out). */
create or replace function public.admin_mfa_enforced()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value ->> 'mfa')::boolean from public.app_config where key = 'admin_security'), false)
$$;

/* is_admin AND (MFA not enforced OR the session authenticated with TOTP).
   The JWT amr claim lists the authentication methods actually used:
   [{"method":"password"},{"method":"totp"}]. */
create or replace function public.is_admin_mfa_verified()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and (
    not public.admin_mfa_enforced()
    or exists (
      select 1
      from jsonb_array_elements(coalesce((auth.jwt() -> 'amr'), '[]'::jsonb)) as a(m)
      where a.m ->> 'method' = 'totp'
    )
  )
$$;

/* Owner-only RPCs re-gated on MFA (idempotent replacements of admin.sql). */
create or replace function public.admin_grant_admin(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_mfa_verified() then raise exception 'forbidden — MFA required'; end if;
  if not public.is_owner() then raise exception 'forbidden'; end if;
  if p_email is null or position('@' in p_email) = 0 then raise exception 'invalid email'; end if;
  insert into public.app_admins (email) values (lower(trim(p_email)))
  on conflict (email) do nothing;
end $$;

create or replace function public.admin_revoke_admin(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_mfa_verified() then raise exception 'forbidden — MFA required'; end if;
  if not public.is_owner() then raise exception 'forbidden'; end if;
  if lower(trim(p_email)) = 'gaurav.123337@gmail.com' then raise exception 'cannot revoke the owner'; end if;
  delete from public.app_admins where email = lower(trim(p_email));
end $$;

/* What the Admin dashboard's security banner shows. */
create or replace function public.admin_security_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'enforced', public.admin_mfa_enforced(),
    'mfaVerified', public.is_admin_mfa_verified(),
    'factors', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'status', f.status))
      from auth.mfa_factors f where f.user_id = auth.uid()
    ), '[]'::jsonb)
  ) into out;
  return out;
end $$;

/* ------------------------------------------------------------------ */
/* 3. Delete my account                                                */
/* ------------------------------------------------------------------ */

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  /* billing records are retained for provider reconciliation/accounting,
     but the identity is removed (the payments themselves stay) */
  update public.payments set user_id = null where user_id = v_uid;
  update public.subscriptions set user_id = null where user_id = v_uid;
  update public.billing_actions set user_id = null, admin_id = null
    where user_id = v_uid or admin_id = v_uid;

  /* team records owned/held by the user are removed */
  delete from public.team_members where user_id = v_uid;
  delete from public.teams where owner_id = v_uid;

  /* PDF documents authored by the user (question drafts) */
  delete from public.pdf_documents where created_by = v_uid;

  /* the user's own admin/audit rows keep the email string (history), but
     their question-bank edits are theirs — drop the email linkage */
  delete from public.question_audit where actor = auth.jwt() ->> 'email';

  /* everything else cascades from auth.users: user_sync, profiles,
     usage_events, uploaded_resumes, career_profiles, entitlements,
     grant codes, coupons, question feedback (user-scoped rows) */
  delete from auth.users where id = v_uid;
end $$;

/* ------------------------------------------------------------------ */
/* 4. Download my data — the user's own server-side rows as JSON.     */
/* ------------------------------------------------------------------ */

create or replace function public.download_my_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  out jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select jsonb_build_object(
    'exported_at', now(),
    'profile', coalesce((select to_jsonb(p) from public.profiles p where p.user_id = v_uid), 'null'::jsonb),
    'user_sync', coalesce((select to_jsonb(u) from public.user_sync u where u.user_id = v_uid), 'null'::jsonb),
    'career_profile', coalesce((select to_jsonb(c) from public.career_profiles c where c.user_id = v_uid), 'null'::jsonb),
    'usage_events', coalesce((select jsonb_agg(to_jsonb(u) order by u.created_at) from public.usage_events u where u.user_id = v_uid), '[]'::jsonb),
    'entitlement', coalesce((select to_jsonb(e) from public.entitlements e where e.user_id = v_uid), 'null'::jsonb),
    'uploaded_resumes', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'size', r.size, 'created_at', r.created_at)) from public.uploaded_resumes r where r.user_id = v_uid), '[]'::jsonb),
    'pdf_documents', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'created_at', d.created_at)) from public.pdf_documents d where d.created_by = v_uid), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'amount', p.amount, 'currency', p.currency, 'status', p.status, 'created_at', p.created_at)) from public.payments p where p.user_id = v_uid), '[]'::jsonb),
    'subscription', coalesce((select to_jsonb(s) from public.subscriptions s where s.user_id = v_uid), 'null'::jsonb)
  ) into out;
  return out;
end $$;

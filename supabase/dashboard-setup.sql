-- InterviewIQ dashboard setup (combined) — paste this WHOLE file into the SQL editor and run.
-- Runs in dependency order: security.sql -> resources.sql -> trends.sql -> recovery-codes.sql

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

-- InterviewIQ resource library schema (docs/resource-safety-guard.md §6) — run
-- once in the Supabase SQL editor (or via scripts/setup-security.js, which
-- applies this file after security.sql):
--   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/setup-security.js
--
-- Adds:
--   1. resources — user-saved links (mode='personal', owner-scoped) and the
--      community library (mode='community', status pending→approved by an
--      admin). Every row carries its guard verdict (resourceGuard).
--   2. RLS: everyone reads approved community rows; owners read their own
--      personal rows; admins read everything. Writes happen ONLY through the
--      edge function (submit-resource, service role) and the RPCs below.
--   3. admin_review_resource — the L4 human gate: admin approves/rejects/
--      quarantines a community submission (MFA-gated like other admin RPCs).
--   4. report_resource — any signed-in user can flag a resource; at 3 flags it
--      auto-quarantines (the post-approval kill switch).
--   5. delete_my_resource — owners may remove their own personal saves.
--   6. admin_audit trigger on resources (uses log_admin_audit from security.sql).

/* ------------------------------------------------------------------ */
/* 1. Table + RLS                                                      */
/* ------------------------------------------------------------------ */

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text not null,
  description text not null default '',
  category text not null default 'general',
  mode text not null check (mode in ('personal', 'community')),
  status text not null default 'pending' check (status in
    ('personal', 'pending', 'approved', 'rejected', 'quarantined')),
  owner_id uuid references auth.users(id) on delete cascade,
  guard jsonb not null default '{}'::jsonb,   -- resourceGuard verdict: {status, reasons, finalUrl, checkedAt, reputation}
  suggested_by text not null default '',       -- email string (audit trail)
  reviewed_by text,                            -- admin email who made the call
  reviewed_at timestamptz,
  flags integer not null default 0,
  votes integer not null default 0,            -- community quality signal (resourceQuality)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resources_community_idx on public.resources (status) where mode = 'community';
create index if not exists resources_owner_idx on public.resources (owner_id) where mode = 'personal';

alter table public.resources enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'resources' and policyname = 'resources read') then
    create policy "resources read" on public.resources for select
      using (
        public.is_admin()
        or (mode = 'community' and status = 'approved')
        or (owner_id = auth.uid())
      );
  end if;
end $$;

/* ------------------------------------------------------------------ */
/* 2. L4 human gate — admin review                                     */
/* ------------------------------------------------------------------ */

create or replace function public.admin_review_resource(p_id uuid, p_decision text, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_mfa_verified() then raise exception 'forbidden — MFA required'; end if;
  if p_decision not in ('approved', 'rejected', 'quarantined') then raise exception 'invalid decision'; end if;
  update public.resources
    set status = p_decision,
        reviewed_by = coalesce(nullif(auth.jwt() ->> 'email', ''), 'system'),
        reviewed_at = now(),
        guard = jsonb_set(coalesce(guard, '{}'::jsonb), '{reviewNote}', to_jsonb(coalesce(p_note, ''))),
        updated_at = now()
    where id = p_id and mode = 'community';
  if not found then raise exception 'submission not found or not a community request'; end if;
end $$;

/* ------------------------------------------------------------------ */
/* 3. Report + auto-quarantine (post-approval kill switch)             */
/* ------------------------------------------------------------------ */

create or replace function public.report_resource(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_flags integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.resources
    set flags = flags + 1,
        updated_at = now()
    where id = p_id;
  if not found then raise exception 'resource not found'; end if;

  select flags into v_flags from public.resources where id = p_id;
  if v_flags >= 3 and exists (select 1 from public.resources where id = p_id and status = 'approved') then
    update public.resources
      set status = 'quarantined', reviewed_by = 'system (auto)', reviewed_at = now(), updated_at = now()
      where id = p_id;
  end if;
end $$;

/* ------------------------------------------------------------------ */
/* 4. Owners may remove their own personal saves                       */
/* ------------------------------------------------------------------ */

create or replace function public.delete_my_resource(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.resources where id = p_id and owner_id = auth.uid() and mode = 'personal';
  if not found then raise exception 'resource not found or not yours'; end if;
end $$;

/* ------------------------------------------------------------------ */
/* 5. Community voting — per-user votes feed the quality score          */
/* ------------------------------------------------------------------ */

alter table public.resources add column if not exists votes integer not null default 0;

create table if not exists public.resource_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  direction integer not null default 1 check (direction in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

alter table public.resource_votes enable row level security;
drop policy if exists "resource votes own" on public.resource_votes;
create policy "resource votes own" on public.resource_votes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* One vote per user per resource (upsert re-votes, never duplicates);
   the resource's running total is recomputed from the votes table. */
create or replace function public.vote_resource(p_id uuid, p_direction integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_direction not in (-1, 1) then raise exception 'invalid direction'; end if;
  insert into public.resource_votes (user_id, resource_id, direction)
    values (v_uid, p_id, p_direction)
  on conflict (user_id, resource_id) do update set direction = excluded.direction;
  update public.resources r
    set votes = coalesce((select sum(v.direction) from public.resource_votes v where v.resource_id = r.id), 0)
    where r.id = p_id;
end $$;

/* ------------------------------------------------------------------ */
/* 6. Audit trail — every resource mutation lands in admin_audit        */
/* ------------------------------------------------------------------ */

drop trigger if exists admin_audit_resources on public.resources;
create trigger admin_audit_resources
  after insert or update or delete on public.resources
  for each row execute function public.log_admin_audit();

-- InterviewIQ trends schema (docs/skill-counselor.md §4) — run once via
-- scripts/setup-security.js (applies security.sql, resources.sql, trends.sql):
--   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/setup-security.js
--
-- Adds:
--   1. skill_signals — one row per skill per weekly sweep (job mentions 30/90d,
--      npm delta, share, blended trend_score + stage). Public read: it's
--      aggregate market data, non-sensitive — the Counselor shows the badges.
--   2. update_proposals — structural changes (promote/demote/review) emitted
--      when a skill's stage CROSSES a boundary. NOT auto-applied: an admin
--      accepts or ignores them (the recorded decision).
--   3. RPCs: latest_skill_signals() (public), admin_pending_proposals(),
--      admin_decision_proposal() (MFA-gated like the other admin RPCs).

/* ------------------------------------------------------------------ */
/* 1. skill_signals                                                    */
/* ------------------------------------------------------------------ */

create table if not exists public.skill_signals (
  skill_id text not null,
  window_start date not null,
  job_mentions_30d integer not null default 0,
  job_mentions_90d integer not null default 0,
  share real not null default 0,
  npm_delta real,
  trend_score real not null default 0,
  stage text not null default 'nascent',
  at timestamptz not null default now(),
  primary key (skill_id, window_start)
);

create index if not exists skill_signals_latest_idx on public.skill_signals (skill_id, window_start desc);

alter table public.skill_signals enable row level security;
drop policy if exists "skill signals public read" on public.skill_signals;
create policy "skill signals public read" on public.skill_signals for select using (true);

/* ------------------------------------------------------------------ */
/* 2. update_proposals — the admin gate for structural changes          */
/* ------------------------------------------------------------------ */

create table if not exists public.update_proposals (
  id bigint generated always as identity primary key,
  skill_id text not null,
  kind text not null check (kind in ('promote', 'review', 'demote')),
  reason text not null,
  signals jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'ignored')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);

create index if not exists update_proposals_pending_idx on public.update_proposals (status, created_at desc);

alter table public.update_proposals enable row level security;
drop policy if exists "proposals admin read" on public.update_proposals;
create policy "proposals admin read" on public.update_proposals for select using (public.is_admin());

/* ------------------------------------------------------------------ */
/* 3. RPCs                                                             */
/* ------------------------------------------------------------------ */

/* Latest signal per skill — public (aggregate market data). */
create or replace function public.latest_skill_signals()
returns table (skill_id text, trend_score real, stage text, job_mentions_30d integer, share real, at timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (skill_id) skill_id, trend_score, stage, job_mentions_30d, share, at
  from public.skill_signals
  order by skill_id, window_start desc;
$$;

/* Pending structural proposals — the Trends admin card. */
create or replace function public.admin_pending_proposals()
returns table (id bigint, skill_id text, kind text, reason text, signals jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, skill_id, kind, reason, signals, created_at
  from public.update_proposals
  where status = 'pending'
  order by created_at desc;
$$;

/* The recorded decision — accepts/ignores a proposal (audit-logged). */
create or replace function public.admin_decision_proposal(p_id bigint, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_mfa_verified() then raise exception 'forbidden — MFA required'; end if;
  if p_decision not in ('accepted', 'ignored') then raise exception 'invalid decision'; end if;
  update public.update_proposals
    set status = p_decision,
        decided_at = now(),
        decided_by = coalesce(nullif(auth.jwt() ->> 'email', ''), 'system')
    where id = p_id;
  if not found then raise exception 'proposal not found'; end if;
end $$;

/* Keep proposals in the admin audit trail too. */
drop trigger if exists admin_audit_proposals on public.update_proposals;
create trigger admin_audit_proposals
  after insert or update or delete on public.update_proposals
  for each row execute function public.log_admin_audit();

-- InterviewIQ MFA recovery codes (docs/app-security.md G8 extension) — run in
-- the Supabase SQL editor AFTER security.sql (or via scripts/setup-live.js,
-- which applies this file as part of the schema batch).
--
-- Adds:
--   1. recovery_codes — one row per one-time recovery code, stored as
--      sha256(email || ':' || code). Owner-scoped, RLS'd. Used once.
--   2. recovery_attempts — brute-force limiter for the mfa-recovery edge
--      function (5 attempts / 15 min per email).
--   3. save_recovery_codes(text[]) — signed-in user stores (replaces) their
--      code hashes after generating a fresh set.
--   4. admin_reset_mfa(text) — service-role-only: removes the user's TOTP
--      factors + AMR claims after a valid recovery code, so the next sign-in
--      completes without a challenge. Not granted to any role — only the edge
--      function (service key) can invoke it.

/* ------------------------------------------------------------------ */
/* 1. Tables + RLS                                                     */
/* ------------------------------------------------------------------ */

create table if not exists public.recovery_codes (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,        -- denormalized for redemption lookup (the
                                    -- edge function queries by email without
                                    -- needing auth.users access)
  code_hash text not null,          -- sha256(lower(email) || ':' || code)
  used_at timestamptz,              -- set when redeemed
  revoked_at timestamptz,           -- set when a newer set replaces this one
  created_at timestamptz not null default now()
);

create index if not exists recovery_codes_owner_idx on public.recovery_codes (owner_id);

/* upgrade path for installs that predate owner_email */
alter table public.recovery_codes add column if not exists owner_email text not null default '';
create index if not exists recovery_codes_email_idx on public.recovery_codes (owner_email);

create table if not exists public.recovery_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists recovery_attempts_email_idx
  on public.recovery_attempts (email, attempted_at desc);

alter table public.recovery_codes enable row level security;
alter table public.recovery_attempts enable row level security;

drop policy if exists "recovery codes owner" on public.recovery_codes;
create policy "recovery codes owner" on public.recovery_codes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

/* attempts are write-only via the edge function's service key; RLS hides
   them from every role so they can't be enumerated or poisoned by users */
drop policy if exists "recovery attempts hidden" on public.recovery_attempts;
create policy "recovery attempts hidden" on public.recovery_attempts for select using (false);

/* ------------------------------------------------------------------ */
/* 2. Save (replace) my recovery code hashes                           */
/* ------------------------------------------------------------------ */

create or replace function public.save_recovery_codes(p_hashes text[])
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_hashes is null or cardinality(p_hashes) = 0 then raise exception 'no codes provided'; end if;
  /* revoke any outstanding codes first — a fresh set invalidates the old */
  update public.recovery_codes set revoked_at = now()
    where owner_id = v_uid and revoked_at is null and used_at is null;
  insert into public.recovery_codes (owner_id, owner_email, code_hash)
  select v_uid, lower(coalesce(nullif(auth.jwt() ->> 'email', ''), 'unknown')), h
  from unnest(p_hashes) as h;
end $$;

grant execute on function public.save_recovery_codes(text[]) to authenticated;

/* ------------------------------------------------------------------ */
/* 3. Service-role-only MFA reset after a valid recovery code          */
/* ------------------------------------------------------------------ */

create or replace function public.admin_reset_mfa(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'user not found'; end if;
  /* drop the AMR 'totp' markers from any live sessions */
  delete from auth.mfa_amr_claims where session_id in (
    select id from auth.sessions where user_id = v_uid
  );
  delete from auth.mfa_challenges where factor_id in (
    select id from auth.mfa_factors where user_id = v_uid
  );
  delete from auth.mfa_factors where user_id = v_uid;
end $$;

/* deliberately NO grant — only the service-role edge function reaches it */

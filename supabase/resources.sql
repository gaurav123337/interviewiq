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

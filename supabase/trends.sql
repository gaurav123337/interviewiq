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

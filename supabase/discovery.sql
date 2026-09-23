-- Phase 4 Item D3 — Takedown engine (docs/phase4-enhancements-plan.md §4 D3)
-- Standalone: protects EXISTING content too. Idempotent; safe to run before or
-- after the app code ships (reads tolerate a missing `status` column until this
-- file is applied — graceful-degradation contract).
--
-- Removal is two-step: soft-delete (status='taken_down', every read path
-- filters it out, mirroring the `published` boolean pattern) → explicit hard
-- purge (admin-only, audited like everything else via question_audit_trg).

/* ------------------------------------------------------------------ */
/* 1. published_questions takedown columns                             */
/* ------------------------------------------------------------------ */

alter table public.published_questions
  add column if not exists status text not null default 'active'
    check (status in ('active', 'taken_down'));
alter table public.published_questions
  add column if not exists taken_down_at timestamptz;
alter table public.published_questions
  add column if not exists takedown_reason text;

create index if not exists published_questions_status_idx
  on public.published_questions (status);

/* ------------------------------------------------------------------ */
/* 2. takedowns — the audit trail (one row per takedown decision)      */
/*    Mirrors the question_audit style: admin-all RLS, actor captured.  */
/* ------------------------------------------------------------------ */

create table if not exists public.takedowns (
  id bigint generated always as identity primary key,
  -- one of: question | source | resource | problem
  target_kind text not null check (target_kind in ('question', 'source', 'resource', 'problem')),
  -- question.id, scraper_sources.id, discovered_resources.id, or a raw URL
  target_id text not null,
  -- normalized question text when the target is a question (drives suppressions)
  question_text text,
  -- why: dmca | license | inaccurate | offensive | duplicate | owner-request | other
  reason text not null,
  note text not null default '',
  actor text not null default '',
  -- 'soft' (default; reversible) or 'purge' (row deleted, this row remains)
  action text not null default 'soft' check (action in ('soft', 'purge')),
  restored_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.takedowns enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'takedowns' and policyname = 'takedowns admin all') then
    create policy "takedowns admin all" on public.takedowns
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

create index if not exists takedowns_target_idx on public.takedowns (target_kind, target_id);
create index if not exists takedowns_created_at_idx on public.takedowns (created_at desc);

/* ------------------------------------------------------------------ */
/* 3. takedown_suppressions — blocklists by question hash              */
/*    buildUpsertSql excludes questions whose hash appears here, so    */
/*    taken-down content can never re-enter the bank via the cron,     */
/*    discovery crawler (D2), or a re-scrape of the same source.       */
/*    Hash = md5(lower-Trim question text) — stable across runs.       */
/* ------------------------------------------------------------------ */

create table if not exists public.takedown_suppressions (
  question_hash text primary key,
  -- the exact question text kept alongside the hash so the scraper can
  -- exclude by text without shipping an md5 implementation into the browser
  question_text text,
  reason text not null default '',
  source_url text,
  actor text not null default '',
  created_at timestamptz not null default now()
);

alter table public.takedown_suppressions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'takedown_suppressions' and policyname = 'takedown suppressions admin all') then
    create policy "takedown suppressions admin all" on public.takedown_suppressions
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

/* ------------------------------------------------------------------ */
/* 4. Auto-suppress on takedown. Taking a question down records its    */
/*    md5(lower(trim(question))) in takedown_suppressions so the       */
/*    scraper can never re-insert it. Restoring a takedown clears it.  */
/* ------------------------------------------------------------------ */

create or replace function public.sync_takedown_suppression()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_kind = 'question' and new.question_text is not null then
    if new.action = 'soft' and new.restored_at is null then
      insert into public.takedown_suppressions (question_hash, question_text, reason, source_url, actor)
      values (md5(lower(trim(new.question_text))), new.question_text, new.reason, null, new.actor)
      on conflict (question_hash) do nothing;
    else
      delete from public.takedown_suppressions
      where question_hash = md5(lower(trim(new.question_text)));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists takedown_suppression_trg on public.takedowns;
create trigger takedown_suppression_trg
  after insert or update on public.takedowns
  for each row execute function public.sync_takedown_suppression();

/* ------------------------------------------------------------------ */
/* 5. Guard: takedown beats publish. A taken-down question cannot be   */
/*    re-published until it is explicitly restored (takedown cleared). */
/* ------------------------------------------------------------------ */

create or replace function public.enforce_takedown_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'taken_down' and new.status = 'taken_down' and new.published = true then
    raise exception 'question % is taken down — restore it before publishing', old.id;
  end if;
  if old.status = 'active' and new.status = 'taken_down' and new.taken_down_at is null then
    new.taken_down_at = now();
  end if;
  if new.status = 'active' then
    new.taken_down_at = null;
  end if;
  return new;
end $$;

drop trigger if exists published_questions_takedown_guard on public.published_questions;
create trigger published_questions_takedown_guard
  before update on public.published_questions
  for each row execute function public.enforce_takedown_status();

-- admin convenience: how many are currently suppressed/taken down
create or replace view public.takedown_summary as
  select
    (select count(*) from public.published_questions where status = 'taken_down') as questions_taken_down,
    (select count(*) from public.takedown_suppressions) as suppressions,
    (select count(*) from public.takedowns where restored_at is null) as open_takedowns;

/* ================================================================== */
/*  Phase 4 Item D2 — discovery storage                                */
/*  crawl-sources.js writes pending seeds (nothing crawls unless a     */
/*  seed is approved) and discovered resources (surfaced only after    */
/*  admin approval + the resource-safety-guard in D4).                 */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* 6. discovery_seeds — URLS the crawler may start from                */
/*    origin: manual (admin "Discover from URL") | skill-auto (D5)     */
/*    status: pending → approved | rejected                            */
/*    Nothing is crawled while a seed is pending — the approval gate   */
/*    is the crawl trigger, not a filter after the fact.               */
/* ------------------------------------------------------------------ */

create table if not exists public.discovery_seeds (
  id bigint generated always as identity primary key,
  url text not null,
  -- discover-lib.classifySeed kinds: github-topic | github-repo | json | sitemap | html
  kind text not null,
  origin text not null default 'manual' check (origin in ('manual', 'skill-auto')),
  -- manual = actor; skill-auto = the skill name that triggered the search
  origin_detail text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- for rejected seeds
  note text not null default '',
  -- which skill the seed targets (D5 gap-filling; free text)
  skill text,
  actor text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (url)
);

alter table public.discovery_seeds enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discovery_seeds' and policyname = 'discovery seeds admin all') then
    create policy "discovery seeds admin all" on public.discovery_seeds
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

create index if not exists discovery_seeds_status_idx on public.discovery_seeds (status, created_at desc);
create index if not exists discovery_seeds_skill_idx on public.discovery_seeds (skill) where skill is not null;

/* ------------------------------------------------------------------ */
/* 7. discovered_resources — candidate learning links found by the     */
/*    crawl. Attribution is mandatory; approved rows are what D4's     */
/*    credits UI renders. A no-license GitHub seed's resources stay    */
/*    pending until a human decides (never auto-enter rotation).       */
/* ------------------------------------------------------------------ */

create table if not exists public.discovered_resources (
  id bigint generated always as identity primary key,
  url text not null,
  title text not null,
  -- resource | qa | problem (what the crawler thinks the link is)
  kind text not null default 'resource' check (kind in ('resource', 'qa', 'problem')),
  -- attribution captured free from GitHub/HTML payloads
  attribution jsonb not null default '{}'::jsonb,
  -- MIT | Apache-2.0 | CC-BY-4.0 | no-license | unknown | …
  license text not null default 'unknown',
  -- pending → approved | rejected (resources only surface after approval)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  seed_id bigint references public.discovery_seeds (id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (url)
);

alter table public.discovered_resources enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discovered_resources' and policyname = 'discovered resources admin all') then
    create policy "discovered resources admin all" on public.discovered_resources
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

create index if not exists discovered_resources_status_idx on public.discovered_resources (status, created_at desc);
create index if not exists discovered_resources_seed_idx on public.discovered_resources (seed_id) where seed_id is not null;

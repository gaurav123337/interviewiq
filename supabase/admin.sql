-- InterviewIQ admin + product-ops schema — run once in the Supabase SQL editor
-- (or via scripts/setup-admin.js). Adds the tables behind the Admin dashboard:
--   app_admins            — email allow-list for the dashboard
--   app_config            — remotely-published feature flags / AI / quotas
--   announcements         — release notes shown as a banner to every client
--   published_questions   — admin-curated question-bank updates (merged client-side)
--   usage_events          — server-side analytics events (sessions, AI calls, opens)
--   profiles              — per-user heartbeat: plan, streak, counters

create table if not exists public.app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at bigint not null
);

create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  badge text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.published_questions (
  id bigint generated always as identity primary key,
  field_id text not null,
  level text not null,
  question text not null,
  answer text not null default '',
  key_points jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  last_seen timestamptz,
  tier text not null default 'free',
  streak integer not null default 0,
  sessions_count integer not null default 0,
  ai_calls integer not null default 0
);

-- keep a profile row for every new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- the admin gate — used by RLS below and by the client (rpc('is_admin'))
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where email = auth.jwt() ->> 'email')
$$;

-- row level security
alter table public.app_admins enable row level security;
alter table public.app_config enable row level security;
alter table public.announcements enable row level security;
alter table public.published_questions enable row level security;
alter table public.usage_events enable row level security;
alter table public.profiles enable row level security;

-- public reads: config, announcements and questions ship to every client
create policy "config public read" on public.app_config for select using (true);
create policy "announcements public read" on public.announcements for select using (true);
create policy "questions public read" on public.published_questions for select using (true);

-- admin-only writes
create policy "config admin write" on public.app_config for all using (public.is_admin()) with check (public.is_admin());
create policy "announcements admin write" on public.announcements for all using (public.is_admin()) with check (public.is_admin());
create policy "questions admin write" on public.published_questions for all using (public.is_admin()) with check (public.is_admin());
create policy "admins read" on public.app_admins for select using (public.is_admin());
create policy "admins write" on public.app_admins for all using (public.is_admin()) with check (public.is_admin());

-- usage events: users insert their own, only admins read
create policy "events own insert" on public.usage_events for insert with check (auth.uid() = user_id);
create policy "events admin read" on public.usage_events for select using (public.is_admin());

-- profiles: users manage their own, admins read everyone
create policy "profiles own select" on public.profiles for select using (auth.uid() = id);
create policy "profiles own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id);
create policy "profiles admin read" on public.profiles for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin RPCs (security definer — server enforces the is_admin gate)
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_users()
returns table (id uuid, email text, created_at timestamptz, last_seen timestamptz,
               tier text, streak integer, sessions_count integer, ai_calls integer)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id, p.email, p.created_at, p.last_seen, p.tier, p.streak, p.sessions_count, p.ai_calls
    from public.profiles p
    order by p.last_seen desc nulls last;
end $$;

create or replace function public.admin_metrics()
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'totalUsers',    (select count(*) from public.profiles),
    'newThisWeek',   (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'activeToday',   (select count(*) from public.profiles where last_seen >= now() - interval '1 day'),
    'active7d',      (select count(*) from public.profiles where last_seen >= now() - interval '7 days'),
    'proUsers',      (select count(*) from public.profiles where tier = 'pro'),
    'totalSessions', coalesce((select sum(sessions_count) from public.profiles), 0),
    'sessions7d',    (select count(*) from public.usage_events where kind = 'session' and created_at >= now() - interval '7 days'),
    'aiCalls7d',     (select count(*) from public.usage_events where kind = 'ai_call' and created_at >= now() - interval '7 days'),
    'events7d',      (select count(*) from public.usage_events where created_at >= now() - interval '7 days')
  ) into out;
  return out;
end $$;

/* ------------------------------------------------------------------ */
/* Automation: RAG foundation + scraper dedupe                         */
/* ------------------------------------------------------------------ */

/* The weekly scraper upserts by question text — enforce uniqueness. */
create unique index if not exists published_questions_question_key
  on public.published_questions (question);

/* Documents ingested by the PDF pipeline (text + optional embeddings).
   The in-app PDF import currently cleans documents into question drafts via
   the AI agent; enabling RAG (grounded tutor answers) is a second phase:
   generate embeddings with an embeddings API key and store them here, then
   query with match_pdf_chunks. */
create table if not exists public.pdf_documents (
  id bigint generated always as identity primary key,
  title text not null,
  source text not null default '',
  char_count integer not null default 0,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table if not exists public.pdf_chunks (
  id bigint generated always as identity primary key,
  document_id bigint not null references public.pdf_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer not null default 0,
  embedding vector(1536)
);

create index if not exists pdf_chunks_document_id_idx on public.pdf_chunks (document_id);

alter table public.pdf_documents enable row level security;
alter table public.pdf_chunks enable row level security;

/* idempotent policy creation (Postgres has no CREATE POLICY IF NOT EXISTS) */
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pdf_documents' and policyname = 'pdf docs public read') then
    create policy "pdf docs public read" on public.pdf_documents for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pdf_chunks' and policyname = 'pdf chunks public read') then
    create policy "pdf chunks public read" on public.pdf_chunks for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pdf_documents' and policyname = 'pdf docs admin write') then
    create policy "pdf docs admin write" on public.pdf_documents for all using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pdf_chunks' and policyname = 'pdf chunks admin write') then
    create policy "pdf chunks admin write" on public.pdf_chunks for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

/* Vector search used once embeddings are populated. Requires pgvector
   (enable it in Supabase: Database → Extensions → vector). */
create or replace function public.match_pdf_chunks(
  query_embedding vector(1536),
  match_count integer default 5
)
returns table (document_id bigint, content text, similarity double precision)
language sql stable security definer set search_path = public as $$
  select p.document_id, p.content, 1 - (p.embedding <=> query_embedding) as similarity
  from public.pdf_chunks p
  where p.embedding is not null
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

/* ------------------------------------------------------------------ */
/* Harvesting + audit log                                              */
/* ------------------------------------------------------------------ */

/* Aggregates per-question performance from session_answers events so the
   admin review inbox can turn real user misses into new bank questions.
   A miss = score <= 2 on the app's 0-5 scale. */
create or replace function public.admin_miss_candidates(min_attempts integer default 2, max_rows integer default 100)
returns table (question text, field_id text, level text, attempts bigint, misses bigint, miss_rate double precision, avg_score double precision)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with flattened as (
      select e.meta->>'fieldId' as field_id,
             e.meta->>'levelId' as level,
             x.value->>'q' as question,
             (x.value->>'score')::numeric as score
      from public.usage_events e
      cross join lateral jsonb_array_elements(e.meta->'items') as x(value)
      where e.kind = 'session_answers'
    )
    select f.question,
           f.field_id,
           f.level,
           count(*) as attempts,
           count(*) filter (where f.score is not null and f.score <= 2) as misses,
           round(100.0 * count(*) filter (where f.score is not null and f.score <= 2) / nullif(count(*), 0), 1) as miss_rate,
           round(avg(f.score)::numeric, 1) as avg_score
    from flattened f
    where f.question is not null and f.question <> ''
    group by f.question, f.field_id, f.level
    having count(*) >= min_attempts
    order by misses desc, miss_rate desc, attempts desc
    limit max_rows;
end $$;

/* Publish-history / rollback log for the question bank. Every insert,
   update and delete (including scraper inserts) is recorded with the actor
   and a before/after diff. */
create table if not exists public.question_audit (
  id bigint generated always as identity primary key,
  question_id bigint,
  action text not null,
  field_id text,
  level text,
  question text,
  actor text not null default '',
  diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.question_audit enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'question_audit' and policyname = 'question audit admin all') then
    create policy "question audit admin all" on public.question_audit for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

create or replace function public.log_question_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  act text; qid bigint; f text; l text; q text; d jsonb; actor_email text;
begin
  actor_email := coalesce(nullif(auth.jwt() ->> 'email', ''), 'system');
  if tg_op = 'INSERT' then
    act := 'create'; qid := new.id; f := new.field_id; l := new.level; q := new.question;
    d := jsonb_build_object('published', new.published);
  elsif tg_op = 'UPDATE' then
    act := 'update'; qid := new.id; f := new.field_id; l := new.level; q := new.question;
    d := jsonb_build_object(
      'before', jsonb_build_object('field_id', old.field_id, 'level', old.level, 'question', old.question, 'answer', old.answer, 'key_points', old.key_points, 'published', old.published),
      'after',  jsonb_build_object('field_id', new.field_id, 'level', new.level, 'question', new.question, 'answer', new.answer, 'key_points', new.key_points, 'published', new.published)
    );
  else
    act := 'delete'; qid := old.id; f := old.field_id; l := old.level; q := old.question;
    d := jsonb_build_object(
      'row', jsonb_build_object('field_id', old.field_id, 'level', old.level, 'question', old.question, 'answer', old.answer, 'key_points', old.key_points, 'published', old.published)
    );
  end if;
  insert into public.question_audit (question_id, action, field_id, level, question, actor, diff)
  values (qid, act, f, l, q, actor_email, d);
  return coalesce(new, old);
end $$;

drop trigger if exists question_audit_trg on public.published_questions;
create trigger question_audit_trg
  after insert or update or delete on public.published_questions
  for each row execute function public.log_question_audit();

/* ------------------------------------------------------------------ */
/* Scraper configuration (admin-dashboard controlled)                  */
/* ------------------------------------------------------------------ */

/* Question sources the weekly scraper pulls from. The admin dashboard
   edits these; the GitHub Actions run reads them from Supabase at run
   time (falls back to content/sources.json when the table is empty). */
create table if not exists public.scraper_sources (
  id text primary key,
  url text not null,
  type text not null default 'markdown',
  field_id text not null,
  level text not null,
  max_items integer not null default 20,
  enabled boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* Scraper settings — single row per key (e.g. schedule: {"days": [1]}). */
create table if not exists public.scraper_config (
  key text primary key,
  value jsonb not null,
  updated_at bigint not null
);

alter table public.scraper_sources enable row level security;
alter table public.scraper_config enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scraper_sources' and policyname = 'scraper sources public read') then
    create policy "scraper sources public read" on public.scraper_sources for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scraper_config' and policyname = 'scraper config public read') then
    create policy "scraper config public read" on public.scraper_config for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scraper_sources' and policyname = 'scraper sources admin write') then
    create policy "scraper sources admin write" on public.scraper_sources for all using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scraper_config' and policyname = 'scraper config admin write') then
    create policy "scraper config admin write" on public.scraper_config for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

/* Seed the dashboard with the same sources the repo ships (idempotent). */
insert into public.scraper_sources (id, url, type, field_id, level, max_items, enabled, note)
values
  ('backend-arialdo-questions', 'https://raw.githubusercontent.com/arialdomartini/Back-End-Developer-Interview-Questions/master/README.md', 'markdown', 'backend', 'senior', 30, true, 'Design-pattern, architecture and language questions.'),
  ('frontend-js-sudheerj', 'https://raw.githubusercontent.com/sudheerj/javascript-interview-questions/master/README.md', 'markdown', 'frontend', 'mid', 25, true, 'Curated JavaScript Q&A bank.'),
  ('frontend-react-sudheerj', 'https://raw.githubusercontent.com/sudheerj/reactjs-interview-questions/master/README.md', 'markdown', 'frontend', 'mid', 20, true, 'Curated React Q&A bank.'),
  ('data-theory-questions', 'https://raw.githubusercontent.com/alexeygrigorev/data-science-interviews/master/theory.md', 'markdown', 'data', 'mid', 25, true, 'Data-science theory questions.')
on conflict (id) do nothing;

/* Weekly Monday 03:00 UTC default, matching the original cron. */
insert into public.scraper_config (key, value, updated_at)
values ('schedule', '{"days": [1], "hour": 3}', 0)
on conflict (key) do nothing;

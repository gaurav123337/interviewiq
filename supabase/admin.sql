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

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Teams (B2B) — orgs, seats, and Pro entitlements                     */
/* ------------------------------------------------------------------ */

/* An organization. `seats` caps the number of active members. */
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  seats integer not null default 5 check (seats between 1 and 500),
  created_at timestamptz not null default now()
);

/* Membership. Invited-but-unregistered people have user_id NULL and an
   invited_email; they claim the seat by signing in and accepting. */
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'active' check (status in ('active','invited')),
  invited_email text,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists team_members_user_idx on public.team_members (user_id);
create index if not exists team_members_team_idx on public.team_members (team_id);
create unique index if not exists team_members_invite_email_idx
  on public.team_members (team_id, lower(invited_email)) where invited_email is not null;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

/* --- helper predicates (security definer so RLS can use them) --- */
create or replace function public.is_team_admin(tid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where team_id = tid and user_id = auth.uid() and role in ('owner','admin') and status = 'active'
  )
$$;

create or replace function public.is_team_member(tid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where team_id = tid and user_id = auth.uid() and status = 'active'
  )
$$;

/* Does the signed-in user hold an active team seat? (drives the Pro entitlement) */
create or replace function public.team_grants_pro()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where user_id = auth.uid() and status = 'active'
  )
$$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'team owner read') then
    create policy "team owner read" on public.teams for select using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'team member read') then
    create policy "team member read" on public.teams for select using (public.is_team_member(id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'team owner write') then
    create policy "team owner write" on public.teams for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_members' and policyname = 'tm member read') then
    create policy "tm member read" on public.team_members for select using (public.is_team_member(team_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_members' and policyname = 'tm admin write') then
    create policy "tm admin write" on public.team_members for all using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_members' and policyname = 'tm own write') then
    create policy "tm own write" on public.team_members for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

/* --- RPCs (all security definer; RLS would block invited users) --- */

create or replace function public.create_team(p_name text, p_seats integer default 5)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'name required'; end if;
  insert into public.teams (name, owner_id, seats)
  values (trim(p_name), auth.uid(), greatest(1, least(500, coalesce(p_seats, 5))))
  returning id into tid;
  insert into public.team_members (team_id, user_id, role, status)
  values (tid, auth.uid(), 'owner', 'active');
  return tid;
end $$;

create or replace function public.invite_member(p_team_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_seats integer; v_members integer; v_email text;
begin
  if not public.is_team_admin(p_team_id) then raise exception 'forbidden'; end if;
  v_email := lower(trim(p_email));
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'invalid email'; end if;
  select seats into v_seats from public.teams where id = p_team_id;
  select count(*) into v_members from public.team_members where team_id = p_team_id and status = 'active';
  if v_members >= v_seats then raise exception 'no seats left'; end if;
  insert into public.team_members (team_id, user_id, role, status, invited_email)
  values (p_team_id, null, 'member', 'invited', v_email)
  on conflict (team_id, lower(invited_email)) where invited_email is not null
  do update set status = 'invited', invited_email = excluded.invited_email;
end $$;

create or replace function public.accept_invite(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_seats integer; v_members integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and status = 'invited'
      and lower(invited_email) = lower(auth.jwt() ->> 'email')
  ) then raise exception 'no pending invite'; end if;
  select seats into v_seats from public.teams where id = p_team_id;
  select count(*) into v_members from public.team_members where team_id = p_team_id and status = 'active';
  if v_members >= v_seats then raise exception 'no seats left'; end if;
  update public.team_members
  set user_id = auth.uid(), status = 'active', invited_email = null
  where team_id = p_team_id and status = 'invited'
    and lower(invited_email) = lower(auth.jwt() ->> 'email');
end $$;

create or replace function public.remove_member(p_team_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_team_admin(p_team_id) then raise exception 'forbidden'; end if;
  if exists (select 1 from public.team_members where team_id = p_team_id and user_id = p_user_id and role = 'owner') then
    raise exception 'cannot remove the owner';
  end if;
  delete from public.team_members where team_id = p_team_id and user_id = p_user_id;
end $$;

create or replace function public.leave_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.team_members where team_id = p_team_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'owner cannot leave; delete the team instead';
  end if;
  if not exists (select 1 from public.team_members where team_id = p_team_id and user_id = auth.uid() and status = 'active') then
    raise exception 'not a member';
  end if;
  delete from public.team_members where team_id = p_team_id and user_id = auth.uid();
end $$;

create or replace function public.delete_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.teams where id = p_team_id and owner_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  delete from public.teams where id = p_team_id;
end $$;

/* --- read helpers (security definer: auth.users emails + invite matching) --- */

create or replace function public.my_teams()
returns table (team_id uuid, team_name text, role text, seats integer, members bigint)
language sql security definer set search_path = public as $$
  select t.id, t.name, m.role, t.seats,
         (select count(*) from public.team_members x where x.team_id = t.id and x.status = 'active') as members
  from public.team_members m
  join public.teams t on t.id = m.team_id
  where m.user_id = auth.uid() and m.status = 'active'
  order by t.created_at;
$$;

create or replace function public.my_pending_invites()
returns table (team_id uuid, team_name text)
language sql security definer set search_path = public as $$
  select m.team_id, t.name
  from public.team_members m
  join public.teams t on t.id = m.team_id
  where m.status = 'invited' and lower(m.invited_email) = lower(auth.jwt() ->> 'email');
$$;

create or replace function public.team_roster(p_team_id uuid)
returns table (user_id uuid, email text, role text, status text, invited_email text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select m.user_id, u.email, m.role, m.status, m.invited_email, m.created_at
  from public.team_members m
  left join auth.users u on u.id = m.user_id
  where m.team_id = p_team_id and public.is_team_member(p_team_id)
  order by m.created_at;
$$;

/* ------------------------------------------------------------------ */
/* Team audit log — every seat change, payment, or config update       */
/* ------------------------------------------------------------------ */

create table if not exists public.team_audit (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  kind text not null,
  meta jsonb not null default '{}'::jsonb,
  actor text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists team_audit_team_idx on public.team_audit (team_id, created_at desc);

alter table public.team_audit enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_audit' and policyname = 'team audit member read') then
    create policy "team audit member read" on public.team_audit for select
      using (public.is_team_member(team_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_audit' and policyname = 'team audit admin write') then
    create policy "team audit admin write" on public.team_audit for all
      using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));
  end if;
end $$;

/* Seat bump RPC — increases seat count and logs the change. */
create or replace function public.bump_team_seats(p_team_id uuid, p_extra integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_old integer; v_new integer;
begin
  if not public.is_team_admin(p_team_id) then raise exception 'forbidden'; end if;
  if p_extra < 1 or p_extra > 500 then raise exception 'extra seats must be 1-500'; end if;
  select seats into v_old from public.teams where id = p_team_id;
  v_new := least(500, v_old + p_extra);
  update public.teams set seats = v_new where id = p_team_id;
  insert into public.team_audit (team_id, kind, meta, actor)
  values (p_team_id, 'seats_bumped', jsonb_build_object('old', v_old, 'extra', p_extra, 'new', v_new), auth.jwt() ->> 'email');
end $$;
/* ------------------------------------------------------------------ */
/* Content Quality Center                                              */
/* ------------------------------------------------------------------ */
/* Adds the tables/RPCs behind the admin dashboard's Quality section:
 *   question_feedback     — 👍/👎/🚩 votes on model answers (any user,
 *                           signed in or not — matches the no-account ethos)
 *   updated_at on
 *     published_questions — staleness tracking (last edit/review)
 *   admin_question_quality— per-question scoreboard (attempts, avg score,
 *                           miss/pass rate, feedback, last seen)
 *   admin_feedback_feed   — recent raw feedback rows
 *   touch_question        — mark a question as reviewed (bumps staleness)
 *
 * The composite quality score itself is computed client-side (quality.ts)
 * from the fields this RPC returns, so it stays unit-testable.
 */

create table if not exists public.question_feedback (
  id bigint generated always as identity primary key,
  user_id uuid,                                   /* null for anonymous users */
  question text not null,
  field_id text,
  level text,
  kind text not null check (kind in ('up', 'down', 'flag')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.question_feedback enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'question_feedback' and policyname = 'feedback public insert') then
    create policy "feedback public insert" on public.question_feedback for insert
      with check (user_id is null or user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'question_feedback' and policyname = 'feedback admin read') then
    create policy "feedback admin read" on public.question_feedback for select
      using (public.is_admin());
  end if;
end $$;

/* staleness: when was this question last edited or marked reviewed? */
alter table public.published_questions add column if not exists updated_at timestamptz not null default now();

/* Auto-bump updated_at on any content change, but only content changes —
   the audit trigger must skip pure updated_at touches so "mark reviewed"
   doesn't spam the activity log with empty diffs. */
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
    /* only updated_at changed (a "mark reviewed" touch) → not a content edit */
    if old.field_id = new.field_id and old.level = new.level and old.question = new.question
       and old.answer = new.answer and old.key_points = new.key_points and old.published = new.published then
      return new;
    end if;
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

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists question_updated_at_trg on public.published_questions;
create trigger question_updated_at_trg
  before update on public.published_questions
  for each row execute function public.touch_updated_at();

drop trigger if exists question_audit_trg on public.published_questions;
create trigger question_audit_trg
  after insert or update or delete on public.published_questions
  for each row execute function public.log_question_audit();

/* Per-question scoreboard: aggregates every scored answer (from
   session_answers events) plus 👍/👎/🚩 feedback. The client merges
   staleness from published_questions and computes the composite score. */
create or replace function public.admin_question_quality(max_rows integer default 300)
returns table (
  question text, field_id text, level text,
  attempts bigint, avg_score double precision, miss_rate double precision, pass_rate double precision,
  ups bigint, downs bigint, flags bigint, last_seen timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with flattened as (
      select e.meta->>'fieldId' as field_id,
             e.meta->>'levelId' as level,
             x.value->>'q' as question,
             (x.value->>'score')::numeric as score,
             e.created_at
      from public.usage_events e
      cross join lateral jsonb_array_elements(e.meta->'items') as x(value)
      where e.kind = 'session_answers'
    ),
    perf as (
      select f.question,
             min(f.field_id) as field_id,
             min(f.level) as level,
             count(*) as attempts,
             round(avg(f.score)::numeric, 1) as avg_score,
             round(100.0 * count(*) filter (where f.score <= 2) / nullif(count(*), 0), 1) as miss_rate,
             round(100.0 * count(*) filter (where f.score >= 3) / nullif(count(*), 0), 1) as pass_rate,
             max(f.created_at) as last_seen
      from flattened f
      where f.question is not null and f.question <> ''
      group by f.question
    ),
    fb as (
      select question,
             count(*) filter (where kind = 'up') as ups,
             count(*) filter (where kind = 'down') as downs,
             count(*) filter (where kind = 'flag') as flags
      from public.question_feedback
      group by question
    )
    select p.question, p.field_id, p.level, p.attempts, p.avg_score, p.miss_rate, p.pass_rate,
           coalesce(fb.ups, 0), coalesce(fb.downs, 0), coalesce(fb.flags, 0), p.last_seen
    from perf p
    left join fb on fb.question = p.question
    order by p.attempts desc
    limit max_rows;
end $$;

/* Recent raw feedback rows (admin review surface). */
create or replace function public.admin_feedback_feed(max_rows integer default 50)
returns table (question text, field_id text, level text, kind text, reason text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select f.question, f.field_id, f.level, f.kind, f.reason, f.created_at
    from public.question_feedback f
    order by f.created_at desc
    limit max_rows;
end $$;

/* Mark a question as reviewed — bumps updated_at (staleness clock restarts)
   and logs a 'refresh' audit entry. */
create or replace function public.touch_question(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select field_id, level, question into r from public.published_questions where id = p_id;
  if not found then raise exception 'question not found'; end if;
  update public.published_questions set updated_at = now() where id = p_id;
  insert into public.question_audit (question_id, action, field_id, level, question, actor, diff)
  values (p_id, 'refresh', r.field_id, r.level, r.question,
          coalesce(nullif(auth.jwt() ->> 'email', ''), 'admin'),
          jsonb_build_object('note', 'reviewed'));
end $$;

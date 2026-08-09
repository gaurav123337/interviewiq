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

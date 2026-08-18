-- AI provider config for the content pipeline (AI cleaner + AI problem bank).
-- Unlike app_config (which is publicly readable — feature flags), this holds
-- the live API key, so it is a PRIVATE admin-only table: RLS permits only
-- is_admin() to read or write. Server-side scripts (ai-clean.js,
-- ai-draft-problems.js) read it through the Management API with the project
-- owner's SUPABASE_ACCESS_TOKEN, which bypasses RLS — the key never touches
-- the public app_config row or GitHub Actions secrets.
--
-- Shape mirrors app_config: single row per logical key, value is a JSON blob.
--   key = 'provider'  →  { "key": "sk-or-v1-...", "base": "https://openrouter.ai/api/v1", "model": "deepseek/deepseek-chat" }

create table if not exists public.ai_provider_config (
  key text primary key,
  value jsonb not null,
  updated_at bigint not null
);

alter table public.ai_provider_config enable row level security;

-- admin-only: read AND write gated on is_admin() — never public
drop policy if exists "ai provider admin read" on public.ai_provider_config;
create policy "ai provider admin read" on public.ai_provider_config
  for select using (public.is_admin());

drop policy if exists "ai provider admin write" on public.ai_provider_config;
create policy "ai provider admin write" on public.ai_provider_config
  for all using (public.is_admin()) with check (public.is_admin());

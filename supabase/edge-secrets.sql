-- App-managed Edge Function secrets.  The credential secrets the admin
-- actually touches day-to-day (Resend, Adzuna, GitHub, Safe Browsing) live
-- HERE, editable from Admin → Secrets — no Supabase dashboard visits for
-- the ones that matter.  The edge functions read this table through a
-- shared loader (_shared/secrets.ts) that falls back to Deno.env, so the
-- legacy dashboard secrets keep working as a fallback for anything not yet
-- entered in the app.
--
-- PRIVATE by design, same shape as ai_provider_config: RLS permits only
-- is_admin() to read or write; edge functions reach it with the service
-- role (bypasses RLS).  Internal shared secrets (RECS_DIGEST_SECRET etc.)
-- stay in env on purpose — they are auto-generated and matched against
-- pg_cron, never user-edited.
--
-- Shape: one row per secret name, value is the raw credential string.
--   name = 'RESEND_API_KEY'  →  value = 're_...'

create table if not exists public.edge_secrets (
  name text primary key,
  value text not null,
  updated_at bigint not null
);

alter table public.edge_secrets enable row level security;

-- admin-only: read AND write gated on is_admin() — never public
drop policy if exists "edge secrets admin read" on public.edge_secrets;
create policy "edge secrets admin read" on public.edge_secrets
  for select using (public.is_admin());

drop policy if exists "edge secrets admin write" on public.edge_secrets;
create policy "edge secrets admin write" on public.edge_secrets
  for all using (public.is_admin()) with check (public.is_admin());

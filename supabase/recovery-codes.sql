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

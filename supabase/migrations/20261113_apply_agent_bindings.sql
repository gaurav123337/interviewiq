/* Paired auto-apply agent credentials.

   - Pairing codes and binding secrets are generated outside Postgres with
     WebCrypto. Only SHA-256 hex digests reach these tables.
   - A public binding UUID makes token lookup indexed; the secret remains a
     256-bit bearer credential and is never stored in plaintext.
   - Every function below is service-role-only. The Edge function authenticates
     signed-in callers and never accepts an agent-supplied owner UUID.
   - public.has_auto_apply_access(uuid) is supplied by the complimentary-grants
     migration. Calls fail closed while that dependency is unavailable.

   Idempotent and safe to re-run. */

create table if not exists public.apply_agent_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists apply_agent_pairing_codes_owner_idx
  on public.apply_agent_pairing_codes (user_id, created_at desc);
create index if not exists apply_agent_pairing_codes_expiry_idx
  on public.apply_agent_pairing_codes (expires_at)
  where used_at is null and revoked_at is null;

create table if not exists public.apply_agent_bindings (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null default 'Paired agent' check (char_length(label) between 1 and 80),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists apply_agent_bindings_owner_idx
  on public.apply_agent_bindings (user_id, created_at desc);
create index if not exists apply_agent_bindings_active_idx
  on public.apply_agent_bindings (user_id, id)
  where revoked_at is null;

/* Durable fixed-window counters complement the per-instance in-memory limiter.
   Keys are SHA-256 digests of an IP/binding scope, never raw addresses/tokens. */
create table if not exists public.apply_agent_rate_limits (
  scope text not null check (scope in ('signed_control', 'pair_exchange', 'agent_action')),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  primary key (scope, key_hash)
);

alter table public.apply_agent_pairing_codes enable row level security;
alter table public.apply_agent_bindings enable row level security;
alter table public.apply_agent_rate_limits enable row level security;

/* No client policies: even row owners use the authenticated Edge endpoints. */
revoke all on table public.apply_agent_pairing_codes from public, anon, authenticated;
revoke all on table public.apply_agent_bindings from public, anon, authenticated;
revoke all on table public.apply_agent_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.apply_agent_pairing_codes to service_role;
grant select, insert, update, delete on table public.apply_agent_bindings to service_role;
grant select, insert, update, delete on table public.apply_agent_rate_limits to service_role;

/* Keep the canonical entitlement dependency behind one service-only function.
   Dynamic SQL lets this additive migration be staged before the grants
   migration; runtime calls remain fail-closed until it exists. */
create or replace function public.service_apply_agent_has_access(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_allowed boolean := false;
begin
  if p_user is null then return false; end if;
  begin
    execute 'select public.has_auto_apply_access($1)'
      into v_allowed
      using p_user;
  exception
    when undefined_function then
      return false;
  end;
  return coalesce(v_allowed, false);
end;
$$;

/* Signed-in create-code endpoint. Hash and short expiry are supplied by the
   Edge function; SQL enforces the maximum lifetime independently. */
create or replace function public.service_apply_agent_issue_code(
  p_user uuid,
  p_code_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.service_apply_agent_has_access(p_user) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid code hash' using errcode = '22023';
  end if;
  if p_expires_at is null
     or p_expires_at <= clock_timestamp()
     or p_expires_at > clock_timestamp() + interval '15 minutes' then
    raise exception 'invalid pairing expiry' using errcode = '22023';
  end if;

  insert into public.apply_agent_pairing_codes (user_id, code_hash, expires_at)
  values (p_user, p_code_hash, p_expires_at)
  returning id into v_id;
  return v_id;
end;
$$;

/* Code exchange is one transaction and locks the candidate code row. A second
   concurrent request sees used_at and receives no row, so exactly one binding
   token can ever be minted from a code. Invalid/expired/used/not-entitled all
   deliberately collapse to an empty result. */
create or replace function public.service_apply_agent_exchange_code(
  p_code_hash text,
  p_binding_id uuid,
  p_token_hash text,
  p_label text default 'Paired agent'
)
returns table (owner_id uuid, binding_id uuid, binding_created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code public.apply_agent_pairing_codes%rowtype;
  v_created timestamptz;
begin
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$'
     or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_binding_id is null then
    return;
  end if;

  select c.* into v_code
  from public.apply_agent_pairing_codes c
  where c.code_hash = p_code_hash
    and c.used_at is null
    and c.revoked_at is null
    and c.expires_at > clock_timestamp()
  for update;

  if not found or not public.service_apply_agent_has_access(v_code.user_id) then
    return;
  end if;

  update public.apply_agent_pairing_codes
  set used_at = clock_timestamp()
  where id = v_code.id and used_at is null and revoked_at is null;
  if not found then return; end if;

  insert into public.apply_agent_bindings (id, user_id, token_hash, label)
  values (
    p_binding_id,
    v_code.user_id,
    p_token_hash,
    coalesce(nullif(left(btrim(p_label), 80), ''), 'Paired agent')
  )
  returning created_at into v_created;

  return query select v_code.user_id, p_binding_id, v_created;
end;
$$;

create or replace function public.service_apply_agent_list_bindings(p_user uuid)
returns table (
  binding_id uuid,
  label text,
  created_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then
    raise exception 'invalid owner' using errcode = '22023';
  end if;
  return query
    select b.id, b.label, b.created_at, b.last_used_at, b.revoked_at
    from public.apply_agent_bindings b
    where b.user_id = p_user
    order by b.created_at desc, b.id;
end;
$$;

create or replace function public.service_apply_agent_revoke_binding(
  p_user uuid,
  p_binding_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then
    raise exception 'invalid owner' using errcode = '22023';
  end if;
  update public.apply_agent_bindings
  set revoked_at = coalesce(revoked_at, clock_timestamp())
  where id = p_binding_id and user_id = p_user;
  return found;
end;
$$;

/* Indexed public-id lookup. The Edge function hashes the presented secret and
   compares the fixed-size digest in constant time before trusting owner_id. */
create or replace function public.service_apply_agent_get_binding(p_binding_id uuid)
returns table (
  owner_id uuid,
  token_hash text,
  created_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.user_id, b.token_hash, b.created_at, b.last_used_at, b.revoked_at
  from public.apply_agent_bindings b
  where b.id = p_binding_id;
$$;

create or replace function public.service_apply_agent_touch_binding(p_binding_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.apply_agent_bindings
  set last_used_at = clock_timestamp()
  where id = p_binding_id and revoked_at is null;
$$;

create or replace function public.service_apply_agent_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_attempts integer;
begin
  if p_scope not in ('signed_control', 'pair_exchange', 'agent_action')
     or p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.apply_agent_rate_limits
    (scope, key_hash, window_started_at, attempts)
  values (p_scope, p_key_hash, v_now, 1)
  on conflict (scope, key_hash) do update set
    window_started_at = case
      when public.apply_agent_rate_limits.window_started_at
           <= v_now - make_interval(secs => p_window_seconds)
      then v_now else public.apply_agent_rate_limits.window_started_at end,
    attempts = case
      when public.apply_agent_rate_limits.window_started_at
           <= v_now - make_interval(secs => p_window_seconds)
      then 1 else public.apply_agent_rate_limits.attempts + 1 end
  returning attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$$;

/* The data action and credential check are one transaction. FOR UPDATE
   serializes with revoke_binding, so a committed revoke blocks every later
   request even if the Edge layer authenticated it just before revocation. */
create or replace function public.service_apply_agent_dispatch(
  p_binding_id uuid, p_token_hash text, p_action text, p_args jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_binding public.apply_agent_bindings%rowtype; v_result jsonb;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select b.* into v_binding from public.apply_agent_bindings b
    where b.id = p_binding_id and b.revoked_at is null and b.token_hash = p_token_hash
    for update;
  if not found or not public.service_apply_agent_has_access(v_binding.user_id) then
    raise exception 'invalid or revoked binding' using errcode = '42501';
  end if;
  v_result := public.apply_agent_action(v_binding.user_id, p_action, p_args);
  update public.apply_agent_bindings set last_used_at = clock_timestamp() where id = v_binding.id;
  return v_result;
end $$;
revoke all on function public.service_apply_agent_dispatch(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.service_apply_agent_dispatch(uuid, text, text, jsonb) to service_role;

revoke all on function public.service_apply_agent_has_access(uuid) from public, anon, authenticated;
revoke all on function public.service_apply_agent_issue_code(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.service_apply_agent_exchange_code(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.service_apply_agent_list_bindings(uuid) from public, anon, authenticated;
revoke all on function public.service_apply_agent_revoke_binding(uuid, uuid) from public, anon, authenticated;
revoke all on function public.service_apply_agent_get_binding(uuid) from public, anon, authenticated;
revoke all on function public.service_apply_agent_touch_binding(uuid) from public, anon, authenticated;
revoke all on function public.service_apply_agent_rate_limit(text, text, integer, integer) from public, anon, authenticated;

grant execute on function public.service_apply_agent_has_access(uuid) to service_role;
grant execute on function public.service_apply_agent_issue_code(uuid, text, timestamptz) to service_role;
grant execute on function public.service_apply_agent_exchange_code(text, uuid, text, text) to service_role;
grant execute on function public.service_apply_agent_list_bindings(uuid) to service_role;
grant execute on function public.service_apply_agent_revoke_binding(uuid, uuid) to service_role;
grant execute on function public.service_apply_agent_get_binding(uuid) to service_role;
grant execute on function public.service_apply_agent_touch_binding(uuid) to service_role;
grant execute on function public.service_apply_agent_rate_limit(text, text, integer, integer) to service_role;

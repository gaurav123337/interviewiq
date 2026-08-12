/* ------------------------------------------------------------------ */
/* Billing — server-verified Pro entitlements                          */
/* ------------------------------------------------------------------ */
/* Pro is now an ACCOUNT property, not a local flag. The entitlements
 * table is the single source of truth: only admins (and the redeem_grant
 * RPC, which marks the code used) can write it. The client reads its own
 * row via get_my_entitlement() — it can never self-grant.
 *
 * grant_codes are single-use, admin-issued codes users redeem to activate
 * Pro — the real replacement for the old client-side format keys (which
 * stay around only as a test-mode fallback, see CONFIG.features).
 *
 * Discounts live on the entitlement (percent + window) so the Upgrade
 * modal can show the user's actual price before checkout. */

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  plan text,                          -- 'monthly' | 'yearly' | 'lifetime' | 'grant' | 'test'
  expires_at timestamptz,             -- null = never (lifetime)
  source text default 'admin',        -- 'admin' | 'grant' | 'stripe' | 'test'
  discount_pct integer not null default 0 check (discount_pct between 0 and 100),
  discount_expires_at timestamptz,
  issued_by uuid,                     -- admin who last granted / set it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grant_codes (
  id bigint generated always as identity primary key,
  code text not null unique,
  plan text not null default 'monthly',
  valid_days integer not null default 30,
  discount_pct integer not null default 0 check (discount_pct between 0 and 100),
  created_by uuid,                    -- admin who created it
  created_at timestamptz not null default now(),
  expires_at timestamptz,             -- null = never expires
  used_by uuid,
  used_at timestamptz
);

alter table public.entitlements enable row level security;
alter table public.grant_codes enable row level security;

-- users read only their own entitlement; admins manage everything
create policy "entitlements own select" on public.entitlements for select using (auth.uid() = user_id);
create policy "entitlements admin all" on public.entitlements for all using (public.is_admin()) with check (public.is_admin());
-- grant codes are never readable by users directly (redeem via RPC)
create policy "grant codes admin all" on public.grant_codes for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- User-facing RPCs
-- ---------------------------------------------------------------------------

/* The signed-in user's entitlement, or an empty row when none exists yet.
   `active` is computed server-side so the client can't argue with expiry. */
create or replace function public.get_my_entitlement()
returns table (
  tier text, plan text, expires_at timestamptz, source text,
  discount_pct integer, discount_expires_at timestamptz,
  active boolean, issued_by uuid, updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select e.tier, e.plan, e.expires_at, e.source, e.discount_pct, e.discount_expires_at,
           (e.tier = 'pro' and (e.expires_at is null or e.expires_at > now())) as active,
           e.issued_by, e.updated_at
    from public.entitlements e
    where e.user_id = auth.uid();
end $$;

/* Redeem a single-use admin-issued grant code. Server-verified: the code must
   exist, be unused and unexpired; then the user's entitlement is set/merged
   and the code is marked used. Returns the resulting entitlement. */
create or replace function public.redeem_grant(p_code text)
returns table (
  tier text, plan text, expires_at timestamptz, source text,
  discount_pct integer, discount_expires_at timestamptz, active boolean
)
language plpgsql security definer set search_path = public as $$
declare
  g public.grant_codes;
  new_expires timestamptz;
  cur public.entitlements;
begin
  select * into g from public.grant_codes where code = upper(trim(p_code));
  if g is null then
    raise exception 'invalid_code';
  end if;
  if g.used_by is not null then
    raise exception 'already_used';
  end if;
  if g.expires_at is not null and g.expires_at <= now() then
    raise exception 'expired';
  end if;

  select * into cur from public.entitlements where user_id = auth.uid();
  new_expires := now() + (g.valid_days || ' days')::interval;

  insert into public.entitlements (user_id, tier, plan, expires_at, source, discount_pct, discount_expires_at, issued_by)
  values (auth.uid(), 'pro', g.plan,
          greatest(new_expires, coalesce(cur.expires_at, new_expires)),
          'grant', g.discount_pct,
          case when g.discount_pct > 0 then greatest(now() + interval '90 days', coalesce(cur.discount_expires_at, now())) else null end,
          g.created_by)
  on conflict (user_id) do update set
    tier = 'pro',
    plan = excluded.plan,
    expires_at = excluded.expires_at,
    source = excluded.source,
    discount_pct = excluded.discount_pct,
    discount_expires_at = excluded.discount_expires_at,
    issued_by = excluded.issued_by,
    updated_at = now();

  update public.grant_codes set used_by = auth.uid(), used_at = now() where id = g.id;

  return query
    select e.tier, e.plan, e.expires_at, e.source, e.discount_pct, e.discount_expires_at,
           (e.tier = 'pro' and (e.expires_at is null or e.expires_at > now())) as active
    from public.entitlements e where e.user_id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Admin RPCs (security definer — is_admin() gate enforced server-side)
-- ---------------------------------------------------------------------------

/* Direct grant/revoke on a user — the admin's "Grant Pro" button (also the
   test path: grant a throwaway account and watch the gate open). */
create or replace function public.admin_set_entitlement(
  p_user uuid, p_tier text, p_plan text default null,
  p_expires timestamptz default null, p_source text default 'admin'
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_tier not in ('free', 'pro') then raise exception 'bad tier'; end if;
  if p_tier = 'free' then
    update public.entitlements
      set tier = 'free', plan = null, expires_at = null, source = p_source, issued_by = auth.uid(), updated_at = now()
      where user_id = p_user;
  else
    insert into public.entitlements (user_id, tier, plan, expires_at, source, issued_by)
    values (p_user, 'pro', p_plan, p_expires, p_source, auth.uid())
    on conflict (user_id) do update set
      tier = 'pro', plan = excluded.plan, expires_at = excluded.expires_at,
      source = excluded.source, issued_by = excluded.issued_by, updated_at = now();
  end if;
end $$;

/* Issue (or clear) a discount on a user's entitlement. */
create or replace function public.admin_issue_discount(
  p_user uuid, p_pct integer, p_days integer default 90
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_pct < 0 or p_pct > 100 then raise exception 'bad pct'; end if;
  insert into public.entitlements (user_id, tier, discount_pct, discount_expires_at, issued_by)
  values (p_user, 'free', p_pct, case when p_pct > 0 then now() + (p_days || ' days')::interval else null end, auth.uid())
  on conflict (user_id) do update set
    discount_pct = excluded.discount_pct,
    discount_expires_at = excluded.discount_expires_at,
    issued_by = excluded.issued_by,
    updated_at = now();
end $$;

/* Create a shareable grant code (single use, redeemable by anyone). Returns
   the code so the admin can copy it to the user. */
create or replace function public.admin_create_grant(
  p_plan text default 'monthly', p_days integer default 30, p_discount_pct integer default 0,
  p_expires timestamptz default null
)
returns text language plpgsql security definer set search_path = public as $$
declare
  code text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  code := 'IQGRANT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
  insert into public.grant_codes (code, plan, valid_days, discount_pct, created_by, expires_at)
  values (code, p_plan, greatest(1, p_days), greatest(0, least(100, p_discount_pct)), auth.uid(), p_expires);
  return code;
end $$;

/* Full entitlement view for the admin billing dashboard. */
create or replace function public.admin_list_entitlements()
returns table (
  user_id uuid, email text, tier text, plan text, expires_at timestamptz,
  source text, discount_pct integer, discount_expires_at timestamptz,
  active boolean, updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id as user_id, p.email, e.tier, e.plan, e.expires_at, e.source,
           e.discount_pct, e.discount_expires_at,
           (e.tier = 'pro' and (e.expires_at is null or e.expires_at > now())) as active,
           e.updated_at
    from public.profiles p
    left join public.entitlements e on e.user_id = p.id
    order by p.last_seen desc nulls last;
end $$;

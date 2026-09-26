/* ------------------------------------------------------------------ */
/* Platinum tier — idempotent migration                                 */
/* ------------------------------------------------------------------ */
/* Platinum = Pro + the local auto-apply engine (Playwright job-search &
 * auto-apply with JD-tailored resume/cover letters). Modeled as a distinct
 * TIER (not a plan) so every existing Pro grant/verify path keeps working:
 * only the three tier-accepting RPCs and the check constraint change.
 * Entitlement rules stay "tier in (free, pro, platinum)" with the same
 * expires_at semantics — Platinum holders simply out-rank Pro checks.
 * Run via scripts/setup-live.js / the SQL editor; safe to re-run.
 */

/* 1. loosen the tier check constraint (drop the old one, whatever its name) */
do $$ declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.entitlements'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%tier%'
  loop
    execute format('alter table public.entitlements drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.entitlements
  add constraint entitlements_tier_check
  check (tier in ('free', 'pro', 'platinum'));

/* 2. plan catalog — platinum is a one-time purchase like lifetime */
create or replace function public.plan_days(p_plan text)
returns integer language sql immutable as $$
  select case p_plan
    when 'monthly' then 30
    when 'yearly' then 365
    when 'platinum' then null  -- one-time, never expires
    else null end;
$$;

/* 3. purchases: accept the platinum plan; the tier stored is PLATINUM when
      the plan is platinum, else pro (unchanged behavior for old plans) */
create or replace function public.apply_purchase(
  p_user uuid, p_provider text, p_external_id text, p_plan text,
  p_amount_minor integer, p_currency text default 'USD', p_discount_pct integer default 0,
  p_kind text default 'one_time'
)
returns void language plpgsql security definer set search_path = public as $$
declare
  days integer := public.plan_days(p_plan);
  cur public.entitlements;
  new_exp timestamptz;
  new_tier text := case when p_plan = 'platinum' then 'platinum' else 'pro' end;
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if days is null and p_plan not in ('lifetime', 'platinum') then
    raise exception 'unknown plan';
  end if;

  select * into cur from public.entitlements where user_id = p_user;
  new_exp := case when days is null then null
                  else greatest(now() + (days || ' days')::interval, coalesce(cur.expires_at, now() + (days || ' days')::interval))
             end;

  insert into public.payments (user_id, provider, provider_payment_id, plan, amount_minor, currency, discount_pct, status, kind)
  values (p_user, p_provider, p_external_id, p_plan, p_amount_minor, p_currency, p_discount_pct, 'paid', p_kind)
  on conflict (provider_payment_id) do nothing;

  insert into public.entitlements (user_id, tier, plan, expires_at, source, issued_by)
  values (p_user, new_tier, p_plan, new_exp, p_provider, auth.uid())
  on conflict (user_id) do update set
    tier = excluded.tier,
    plan = excluded.plan,
    expires_at = excluded.expires_at,
    source = excluded.source,
    issued_by = excluded.issued_by,
    updated_at = now();

  insert into public.billing_actions (admin_id, action, user_id, detail)
  values (auth.uid(), 'purchase', p_user,
          jsonb_build_object('provider', p_provider, 'external_id', p_external_id, 'plan', p_plan, 'kind', p_kind));
end $$;

/* 4. admin grants: accept 'platinum' as a tier (plan defaults to platinum too) */
create or replace function public.admin_set_entitlement(
  p_user uuid, p_tier text, p_plan text default null,
  p_expires timestamptz default null, p_source text default 'admin'
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_tier not in ('free', 'pro', 'platinum') then raise exception 'bad tier'; end if;
  if p_tier = 'free' then
    update public.entitlements
      set tier = 'free', plan = null, expires_at = null, source = p_source, issued_by = auth.uid(), updated_at = now()
      where user_id = p_user;
  else
    insert into public.entitlements (user_id, tier, plan, expires_at, source, issued_by)
    values (p_user, p_tier, coalesce(p_plan, case when p_tier = 'platinum' then 'platinum' end), p_expires, p_source, auth.uid())
    on conflict (user_id) do update set
      tier = excluded.tier, plan = excluded.plan, expires_at = excluded.expires_at,
      source = excluded.source, issued_by = excluded.issued_by, updated_at = now();
  end if;
  perform public.log_billing_action(case when p_tier = 'free' then 'revoke' else 'grant' end, p_user,
    jsonb_build_object('plan', p_plan, 'expires', p_expires, 'source', p_source));
end $$;

/* 5. grant codes can mint Platinum too (p_plan = 'platinum'). Same contract
      as the existing redeem_grant (used_by/valid_days, returns the reader's
      table shape) — only the tier mapping changes. */
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
  new_tier text;
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
  new_tier := case when g.plan = 'platinum' then 'platinum' else 'pro' end;

  update public.grant_codes set used_by = auth.uid(), used_at = now() where id = g.id;
  perform public.log_billing_action('redeem', auth.uid(), jsonb_build_object('code', g.code, 'plan', g.plan));

  insert into public.entitlements (user_id, tier, plan, expires_at, source, discount_pct, discount_expires_at, issued_by)
  values (auth.uid(), new_tier, g.plan,
          greatest(new_expires, coalesce(cur.expires_at, new_expires)),
          'grant', g.discount_pct,
          case when g.discount_pct > 0 then greatest(now() + interval '90 days', coalesce(cur.discount_expires_at, now())) else null end,
          g.created_by)
  on conflict (user_id) do update set
    tier = excluded.tier,
    plan = excluded.plan,
    expires_at = excluded.expires_at,
    source = excluded.source,
    discount_pct = excluded.discount_pct,
    discount_expires_at = excluded.discount_expires_at,
    issued_by = excluded.issued_by,
    updated_at = now();

  return query
    select e.tier, e.plan, e.expires_at, e.source, e.discount_pct, e.discount_expires_at,
           (e.tier in ('pro', 'platinum') and (e.expires_at is null or e.expires_at > now())) as active
    from public.entitlements e where e.user_id = auth.uid();
end $$;

/* 6. entitlement reader exposes is_platinum so the client never string-matches.
      The return type gains a column — DROP first (Postgres can't change an
      existing function's OUT row type in place). */
drop function if exists public.get_my_entitlement();
create or replace function public.get_my_entitlement()
returns table (
  tier text, plan text, expires_at timestamptz, source text,
  discount_pct integer, discount_expires_at timestamptz,
  active boolean, is_platinum boolean, issued_by uuid, updated_at timestamptz
) language sql stable security definer set search_path = public as $$
  select e.tier, e.plan, e.expires_at, e.source, e.discount_pct, e.discount_expires_at,
         (e.tier in ('pro', 'platinum') and (e.expires_at is null or e.expires_at > now())) as active,
         (e.tier = 'platinum' and (e.expires_at is null or e.expires_at > now())) as is_platinum,
         e.issued_by, e.updated_at
  from public.entitlements e where e.user_id = auth.uid();
$$;

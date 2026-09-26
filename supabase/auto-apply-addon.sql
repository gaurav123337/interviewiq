/* ------------------------------------------------------------------ */
/* Auto-apply ADD-ON — pay extra, works with ANY tier                   */
/* ------------------------------------------------------------------ */
/* The auto-apply engine is an optional paid add-on on top of whatever
 * plan the user already has (free/pro/platinum): `addons.auto_apply`
 * carries its own expiry (null = never). Platinum keeps bundling it
 * implicitly (is_platinum implies access) — the add-on is the
 * pay-extra path for everyone else. Server-computed flags only; the
 * client can never self-grant. Idempotent; safe to re-run.
 */

alter table public.entitlements add column if not exists addons jsonb not null default '{}'::jsonb;

/* plan catalog — auto_apply is a one-time add-on (null days) */
create or replace function public.plan_days(p_plan text)
returns integer language sql immutable as $$
  select case p_plan
    when 'monthly' then 30
    when 'yearly' then 365
    when 'platinum' then null  -- one-time, never expires
    when 'auto_apply' then null -- add-on: never expires (perpetual license)
    else null end;
$$;

/* purchases: the auto_apply plan grants ONLY the add-on (tier untouched) —
   a free-tier user can buy the add-on without becoming Pro */
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
  new_addons jsonb;
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if days is null and p_plan not in ('lifetime', 'platinum', 'auto_apply') then
    raise exception 'unknown plan';
  end if;

  select * into cur from public.entitlements where user_id = p_user;

  if p_plan = 'auto_apply' then
    /* add-on: set addons.auto_apply with a far-future expiry sentinel that
       reads as perpetual (expires_at stays null → never); the flag itself
       records granted_at so refunds/audits can see when it was added */
    new_addons := cur.addons || jsonb_build_object('auto_apply', jsonb_build_object(
      'granted_at', now(), 'expires_at', null, 'source', p_provider));
    new_exp := cur.expires_at; /* tier expiry untouched */
  else
    new_addons := cur.addons;
    new_exp := case when days is null then null
                    else greatest(now() + (days || ' days')::interval, coalesce(cur.expires_at, now() + (days || ' days')::interval))
               end;
  end if;

  insert into public.payments (user_id, provider, provider_payment_id, plan, amount_minor, currency, discount_pct, status, kind)
  values (p_user, p_provider, p_external_id, p_plan, p_amount_minor, p_currency, p_discount_pct, 'paid', p_kind)
  on conflict (provider_payment_id) do nothing;

  insert into public.entitlements (user_id, tier, plan, expires_at, addons, source, issued_by)
  values (p_user,
          case when p_plan = 'auto_apply' then coalesce(cur.tier, 'free') else new_tier end,
          case when p_plan = 'auto_apply' then cur.plan else p_plan end,
          new_exp, new_addons, p_provider, auth.uid())
  on conflict (user_id) do update set
    tier = excluded.tier,
    plan = excluded.plan,
    expires_at = excluded.expires_at,
    addons = excluded.addons,
    source = excluded.source,
    issued_by = excluded.issued_by,
    updated_at = now();

  insert into public.billing_actions (admin_id, action, user_id, detail)
  values (auth.uid(), 'purchase', p_user,
          jsonb_build_object('provider', p_provider, 'external_id', p_external_id, 'plan', p_plan, 'kind', p_kind));
end $$;

/* reader: auto_apply is server-computed — active add-on OR platinum bundle */
drop function if exists public.get_my_entitlement();
create or replace function public.get_my_entitlement()
returns table (
  tier text, plan text, expires_at timestamptz, source text,
  discount_pct integer, discount_expires_at timestamptz,
  active boolean, is_platinum boolean, auto_apply boolean, issued_by uuid, updated_at timestamptz
) language sql stable security definer set search_path = public as $$
  select e.tier, e.plan, e.expires_at, e.source, e.discount_pct, e.discount_expires_at,
         (e.tier in ('pro', 'platinum') and (e.expires_at is null or e.expires_at > now())) as active,
         (e.tier = 'platinum' and (e.expires_at is null or e.expires_at > now())) as is_platinum,
         (coalesce((e.addons -> 'auto_apply' ->> 'expires_at') is null
                     and e.addons -> 'auto_apply' is not null, false)
          or (e.tier = 'platinum' and (e.expires_at is null or e.expires_at > now()))) as auto_apply,
         e.issued_by, e.updated_at
  from public.entitlements e where e.user_id = auth.uid();
$$;

/* admin listing gains the addon flag (return type changed → drop first) */
drop function if exists public.admin_list_entitlements();
create or replace function public.admin_list_entitlements()
returns table (
  user_id uuid, email text, tier text, plan text, expires_at timestamptz,
  source text, discount_pct integer, discount_expires_at timestamptz,
  active boolean, auto_apply boolean, updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select e.user_id, pr.email, e.tier, e.plan, e.expires_at,
           e.source, e.discount_pct, e.discount_expires_at,
           (e.tier in ('pro','platinum') and (e.expires_at is null or e.expires_at > now())) as active,
           (coalesce((e.addons -> 'auto_apply' ->> 'expires_at') is null and e.addons -> 'auto_apply' is not null, false)
            or (e.tier = 'platinum' and (e.expires_at is null or e.expires_at > now()))) as auto_apply,
           e.updated_at
    from public.entitlements e
    left join public.profiles pr on pr.id = e.user_id
    order by e.updated_at desc;
end $$;

/* admin: grant/revoke the add-on directly (the "Add-on" button) */
create or replace function public.admin_set_addon(
  p_user uuid, p_addon text, p_on boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_addon <> 'auto_apply' then raise exception 'unknown addon'; end if;
  update public.entitlements
    set addons = case when p_on
                      then coalesce(addons, '{}'::jsonb) || jsonb_build_object(p_addon, jsonb_build_object('granted_at', now(), 'expires_at', null, 'source', 'admin'))
                      else coalesce(addons, '{}'::jsonb) - p_addon end,
        issued_by = auth.uid(), updated_at = now()
    where user_id = p_user;
  if not found then
    insert into public.entitlements (user_id, tier, addons, source, issued_by)
    values (p_user, 'free', case when p_on
              then jsonb_build_object(p_addon, jsonb_build_object('granted_at', now(), 'expires_at', null, 'source', 'admin'))
              else '{}'::jsonb end, 'admin', auth.uid())
    on conflict (user_id) do nothing;
  end if;
  perform public.log_billing_action(case when p_on then 'addon_grant' else 'addon_revoke' end, p_user,
    jsonb_build_object('addon', p_addon));
end $$;

/* refunds: an auto_apply refund removes the ADD-ON (tier/days untouched);
   every other plan refunds exactly as billing2.sql did (partial refunds
   scale the days, lifetime → expires now). Same signature and audit shape. */
create or replace function public.apply_refund(p_provider_payment_id text, p_reason text default null,
  p_amount_minor integer default null, p_within_grace boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
  ent public.entitlements;
  days integer;
  new_exp timestamptz;
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;

  select * into pay from public.payments where provider_payment_id = p_provider_payment_id;
  if pay is null then raise exception 'no such payment'; end if;
  if pay.status = 'refunded' then raise exception 'already refunded'; end if;

  update public.payments set status = 'refunded' where id = pay.id;

  select * into ent from public.entitlements where user_id = pay.user_id;

  if pay.plan = 'auto_apply' then
    /* the add-on is perpetual — a refund simply removes the flag */
    update public.entitlements
      set addons = coalesce(addons, '{}'::jsonb) - 'auto_apply', updated_at = now()
      where user_id = pay.user_id;
  elsif ent is not null and ent.expires_at is not null then
    days := public.plan_days(pay.plan);
    if days is not null then
      /* partial refunds take back only the refunded share of the plan days */
      if p_amount_minor is not null and pay.amount_minor > 0 and p_amount_minor < pay.amount_minor then
        days := greatest(1, round(days * p_amount_minor::numeric / pay.amount_minor::numeric))::integer;
      end if;
      new_exp := greatest(now(), ent.expires_at - (days || ' days')::interval);
    else
      new_exp := now();
    end if;
    update public.entitlements
      set expires_at = new_exp, updated_at = now()
      where user_id = pay.user_id;
  end if;

  insert into public.billing_actions (admin_id, action, user_id, detail)
  values (auth.uid(), 'refund', pay.user_id,
          jsonb_build_object('provider', pay.provider, 'external_id', p_provider_payment_id, 'plan', pay.plan,
                             'amount_minor', coalesce(p_amount_minor, pay.amount_minor),
                             'partial', p_amount_minor is not null and p_amount_minor < pay.amount_minor,
                             'within_grace', p_within_grace)
            || case when p_reason is not null and btrim(p_reason) <> ''
                    then jsonb_build_object('reason', btrim(left(p_reason, 200))) else '{}'::jsonb end);
end $$;

/* Complimentary plans — terminal, additive migration.

   Paid entitlements and payments stay authoritative and untouched. Free access
   lives in its own ledger, so revoking a gift cannot erase a purchase. This
   file also replaces the final entitlement readers and gift-code transaction;
   apply it after billing.sql, payments.sql, platinum.sql and
   auto-apply-addon.sql. Safe to re-run. */

/* Audit helpers are reachable only through guarded definer operations; users
   cannot forge gift/payment history by calling the helper directly. */
revoke execute on function public.log_billing_action(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.log_billing_action(text, uuid, jsonb) to service_role;

/* -------------------------------------------------------------------------- */
/* Complimentary ledger                                                       */
/* -------------------------------------------------------------------------- */

create table if not exists public.complimentary_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null check (product in ('monthly', 'yearly', 'lifetime', 'platinum', 'auto_apply')),
  source text not null check (source in ('admin', 'gift_code')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  grant_code_id bigint unique references public.grant_codes(id) on delete set null,
  code text,
  reason text,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complimentary_grants_expiry_check check (expires_at is null or expires_at > starts_at)
);

create index if not exists complimentary_grants_user_active_idx
  on public.complimentary_grants (user_id, starts_at, expires_at)
  where revoked_at is null;

alter table public.complimentary_grants enable row level security;
drop policy if exists "complimentary grants admin read" on public.complimentary_grants;
create policy "complimentary grants admin read" on public.complimentary_grants
  for select to authenticated using (public.is_admin());

/* Reads go through the admin RPC; only the migration owner/service role can
   write, which prevents an admin browser from bypassing the audit function. */
revoke all on table public.complimentary_grants from anon;
revoke insert, update, delete on table public.complimentary_grants from authenticated;
grant select on table public.complimentary_grants to authenticated;
grant all on table public.complimentary_grants to service_role;

/* Existing codes keep their old plan/duration. New rows use product +
   grant_days (0 means no access expiry); the legacy columns remain so old
   clients and already-redeemed rows are not rewritten. */
alter table public.grant_codes add column if not exists product text;
alter table public.grant_codes add column if not exists grant_days integer;
alter table public.grant_codes add column if not exists reason text;

update public.grant_codes
set product = case when plan in ('monthly', 'yearly', 'lifetime', 'platinum', 'auto_apply')
                   then plan else 'monthly' end
where product is null;

update public.grant_codes
set grant_days = greatest(1, valid_days)
where grant_days is null;

alter table public.grant_codes alter column product set default 'monthly';
alter table public.grant_codes alter column product set not null;
alter table public.grant_codes alter column grant_days set default 30;
alter table public.grant_codes alter column grant_days set not null;
alter table public.grant_codes drop constraint if exists grant_codes_product_check;
alter table public.grant_codes add constraint grant_codes_product_check
  check (product in ('monthly', 'yearly', 'lifetime', 'platinum', 'auto_apply'));
alter table public.grant_codes drop constraint if exists grant_codes_grant_days_check;
alter table public.grant_codes add constraint grant_codes_grant_days_check check (grant_days >= 0);

/* Old add-on writers omitted active while one old reader required it. Stamp the
   explicit bit once; expires_at null remains the one perpetual sentinel. */
update public.entitlements
set addons = jsonb_set(coalesce(addons, '{}'::jsonb), '{auto_apply,active}', 'true'::jsonb, true)
where jsonb_typeof(addons -> 'auto_apply') = 'object'
  and not ((addons -> 'auto_apply') ? 'active');

/* -------------------------------------------------------------------------- */
/* Canonical access predicates and effective entitlement                       */
/* -------------------------------------------------------------------------- */

/* Arbitrary-user checks are service-only. User-facing RPCs below derive the
   subject from auth.uid(); callers can never probe another account. */
create or replace function public.has_auto_apply_access(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    /* Admin is an account property; test the target profile, not the caller's
       service-role JWT. The owner is implicit in is_admin(), so include it. */
    exists (
      select 1
      from auth.users u
      where u.id = p_user
        and (
          lower(coalesce(u.email, '')) = 'gaurav.123337@gmail.com'
          or exists (
            select 1 from public.app_admins a
            where lower(a.email) = lower(coalesce(u.email, ''))
          )
        )
    )
    or exists (
      select 1
      from public.entitlements e
      where e.user_id = p_user
        and (
          (e.tier = 'platinum' and (e.expires_at is null or e.expires_at > now()))
          or (
            jsonb_typeof(e.addons -> 'auto_apply') = 'object'
            and coalesce(e.addons -> 'auto_apply' ->> 'active', 'true') <> 'false'
            and (
              nullif(e.addons -> 'auto_apply' ->> 'expires_at', '') is null
              or nullif(e.addons -> 'auto_apply' ->> 'expires_at', '')::timestamptz > now()
            )
          )
        )
    )
    or exists (
      select 1
      from public.complimentary_grants g
      where g.user_id = p_user
        and g.product in ('platinum', 'auto_apply')
        and g.starts_at <= now()
        and (g.expires_at is null or g.expires_at > now())
        and g.revoked_at is null
    )
  );
$$;

revoke execute on function public.has_auto_apply_access(uuid) from anon, public, authenticated;
grant execute on function public.has_auto_apply_access(uuid) to service_role;

/* One resolver keeps the self and admin readers byte-for-byte consistent. The
   original columns stay first and retain their names; paid_* exposes the
   underlying purchase row, while complimentary_* identifies the active gift
   used for display. Existing clients may ignore every appended column. */
create or replace function public.effective_entitlement(p_user uuid)
returns table (
  tier text,
  plan text,
  expires_at timestamptz,
  source text,
  discount_pct integer,
  discount_expires_at timestamptz,
  active boolean,
  is_platinum boolean,
  auto_apply boolean,
  issued_by uuid,
  updated_at timestamptz,
  paid_tier text,
  paid_plan text,
  paid_expires_at timestamptz,
  paid_source text,
  complimentary boolean,
  complimentary_grant_id bigint,
  complimentary_product text,
  complimentary_source text,
  complimentary_expires_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with paid as (
    select e.* from public.entitlements e where e.user_id = p_user
  ),
  active_grants as (
    select g.*
    from public.complimentary_grants g
    where g.user_id = p_user
      and g.starts_at <= now()
      and (g.expires_at is null or g.expires_at > now())
      and g.revoked_at is null
  ),
  core_candidates as (
    select e.tier,
           e.plan,
           e.expires_at,
           e.source,
           e.issued_by,
           e.updated_at,
           false as is_complimentary
    from paid e
    where e.tier in ('pro', 'platinum')
      and (e.expires_at is null or e.expires_at > now())

    union all

    select case when g.product = 'platinum' then 'platinum' else 'pro' end,
           g.product,
           g.expires_at,
           case when g.source = 'gift_code' then 'gift' else 'complimentary' end,
           g.issued_by,
           g.updated_at,
           true
    from active_grants g
    where g.product <> 'auto_apply'
  ),
  chosen as (
    select c.*
    from core_candidates c
    /* Platinum wins on capability; within a tier, perpetual/latest access wins.
       Paid wins only an exact tie, leaving its provenance stable. */
    order by (c.tier = 'platinum') desc,
             (c.expires_at is null) desc,
             c.expires_at desc nulls last,
             case c.plan
               when 'platinum' then 5 when 'lifetime' then 4
               when 'yearly' then 3 when 'monthly' then 2 else 1 end desc,
             c.is_complimentary asc
    limit 1
  ),
  display_grant as (
    select g.*
    from active_grants g
    order by case g.product
               when 'platinum' then 5 when 'auto_apply' then 4
               when 'lifetime' then 3 when 'yearly' then 2 else 1 end desc,
             (g.expires_at is null) desc,
             g.expires_at desc nulls last,
             g.id desc
    limit 1
  )
  select case when c.tier is not null then c.tier else coalesce(e.tier, 'free') end as tier,
         case when c.tier is not null then c.plan else e.plan end as plan,
         case when c.tier is not null then c.expires_at else e.expires_at end as expires_at,
         case when c.tier is not null then c.source else e.source end as source,
         coalesce(e.discount_pct, 0) as discount_pct,
         e.discount_expires_at,
         (c.tier is not null) as active,
         (c.tier = 'platinum') as is_platinum,
         public.has_auto_apply_access(p_user) as auto_apply,
         case when c.tier is not null then c.issued_by else e.issued_by end as issued_by,
         case when c.tier is not null then c.updated_at else e.updated_at end as updated_at,
         e.tier as paid_tier,
         e.plan as paid_plan,
         e.expires_at as paid_expires_at,
         e.source as paid_source,
         (g.id is not null) as complimentary,
         g.id as complimentary_grant_id,
         g.product as complimentary_product,
         g.source as complimentary_source,
         g.expires_at as complimentary_expires_at
  from (select 1) seed
  left join paid e on true
  left join chosen c on true
  left join display_grant g on true
  where p_user is not null
    and (
      p_user = auth.uid()
      or auth.jwt() ->> 'role' = 'service_role'
      or public.is_admin()
    );
$$;

revoke execute on function public.effective_entitlement(uuid) from anon, public, authenticated;
grant execute on function public.effective_entitlement(uuid) to service_role;

drop function if exists public.get_my_entitlement();
create function public.get_my_entitlement()
returns table (
  tier text, plan text, expires_at timestamptz, source text,
  discount_pct integer, discount_expires_at timestamptz,
  active boolean, is_platinum boolean, auto_apply boolean,
  issued_by uuid, updated_at timestamptz,
  paid_tier text, paid_plan text, paid_expires_at timestamptz, paid_source text,
  complimentary boolean, complimentary_grant_id bigint,
  complimentary_product text, complimentary_source text,
  complimentary_expires_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select * from public.effective_entitlement(auth.uid());
$$;

revoke execute on function public.get_my_entitlement() from anon, public;
grant execute on function public.get_my_entitlement() to authenticated;

drop function if exists public.admin_list_entitlements();
create function public.admin_list_entitlements()
returns table (
  user_id uuid, email text, tier text, plan text, expires_at timestamptz,
  source text, discount_pct integer, discount_expires_at timestamptz,
  active boolean, auto_apply boolean, updated_at timestamptz,
  is_platinum boolean, issued_by uuid,
  paid_tier text, paid_plan text, paid_expires_at timestamptz, paid_source text,
  complimentary boolean, complimentary_grant_id bigint,
  complimentary_product text, complimentary_source text,
  complimentary_expires_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id, p.email,
           x.tier, x.plan, x.expires_at, x.source,
           x.discount_pct, x.discount_expires_at,
           x.active, x.auto_apply, x.updated_at,
           x.is_platinum, x.issued_by,
           x.paid_tier, x.paid_plan, x.paid_expires_at, x.paid_source,
           x.complimentary, x.complimentary_grant_id,
           x.complimentary_product, x.complimentary_source,
           x.complimentary_expires_at
    from public.profiles p
    cross join lateral public.effective_entitlement(p.id) x
    order by p.last_seen desc nulls last, p.created_at desc;
end $$;

revoke execute on function public.admin_list_entitlements() from anon, public;
grant execute on function public.admin_list_entitlements() to authenticated, service_role;

/* -------------------------------------------------------------------------- */
/* Direct complimentary administration                                        */
/* -------------------------------------------------------------------------- */

create or replace function public.admin_grant_complimentary(
  p_user uuid,
  p_product text,
  p_expires timestamptz default null,
  p_reason text default null,
  p_starts timestamptz default now()
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_product text := lower(trim(coalesce(p_product, '')));
  v_reason text := nullif(btrim(left(coalesce(p_reason, ''), 500)), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user is null then raise exception 'user_required'; end if;
  if v_product not in ('monthly', 'yearly', 'lifetime', 'platinum', 'auto_apply') then
    raise exception 'bad_product';
  end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  if p_starts is null then raise exception 'start_required'; end if;
  if p_expires is not null and p_expires <= p_starts then raise exception 'bad_expiry'; end if;

  insert into public.complimentary_grants
    (user_id, product, source, starts_at, expires_at, issued_by, reason)
  values
    (p_user, v_product, 'admin', p_starts, p_expires, auth.uid(), v_reason)
  returning id into v_id;

  perform public.log_billing_action(
    'complimentary_grant', p_user,
    jsonb_build_object('grant_id', v_id, 'product', v_product, 'source', 'admin',
                       'starts_at', p_starts, 'expires_at', p_expires, 'reason', v_reason)
  );
  return v_id;
end $$;

create or replace function public.admin_revoke_complimentary(
  p_grant_id bigint,
  p_reason text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  g public.complimentary_grants;
  v_reason text := nullif(btrim(left(coalesce(p_reason, ''), 500)), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into g
  from public.complimentary_grants
  where id = p_grant_id
  for update;
  if not found then raise exception 'grant_not_found'; end if;

  /* Idempotent retry: the first revoke owns the timestamp and audit row. */
  if g.revoked_at is not null then return; end if;

  update public.complimentary_grants
  set revoked_at = now(), revoked_by = auth.uid(), revoked_reason = v_reason, updated_at = now()
  where id = g.id;

  perform public.log_billing_action(
    'complimentary_revoke', g.user_id,
    jsonb_build_object('grant_id', g.id, 'product', g.product, 'source', g.source,
                       'reason', v_reason)
  );
end $$;

create or replace function public.admin_list_complimentary_grants(
  p_user uuid default null,
  p_active_only boolean default true
)
returns table (
  grant_id bigint, user_id uuid, email text,
  product text, source text, starts_at timestamptz, expires_at timestamptz,
  issued_by uuid, code text, reason text,
  revoked_at timestamptz, revoked_by uuid, revoked_reason text,
  created_at timestamptz, updated_at timestamptz, active boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select g.id, g.user_id, p.email,
           g.product, g.source, g.starts_at, g.expires_at,
           g.issued_by, g.code, g.reason,
           g.revoked_at, g.revoked_by, g.revoked_reason,
           g.created_at, g.updated_at,
           (g.revoked_at is null and g.starts_at <= now()
             and (g.expires_at is null or g.expires_at > now())) as active
    from public.complimentary_grants g
    left join public.profiles p on p.id = g.user_id
    where (p_user is null or g.user_id = p_user)
      and (
        not p_active_only
        or (g.revoked_at is null and g.starts_at <= now()
          and (g.expires_at is null or g.expires_at > now()))
      )
    order by g.created_at desc, g.id desc;
end $$;

revoke execute on function public.admin_grant_complimentary(uuid, text, timestamptz, text, timestamptz) from anon, public;
revoke execute on function public.admin_revoke_complimentary(bigint, text) from anon, public;
revoke execute on function public.admin_list_complimentary_grants(uuid, boolean) from anon, public;
grant execute on function public.admin_grant_complimentary(uuid, text, timestamptz, text, timestamptz) to authenticated, service_role;
grant execute on function public.admin_revoke_complimentary(bigint, text) to authenticated, service_role;
grant execute on function public.admin_list_complimentary_grants(uuid, boolean) to authenticated, service_role;

/* -------------------------------------------------------------------------- */
/* Product-aware, atomic single-use gift codes                                */
/* -------------------------------------------------------------------------- */

/* Keep the old four-argument signature so deployed clients continue to work.
   p_days=0 is the additive no-expiry convention; discount_pct is retained only
   as legacy code metadata—checkout coupons remain the payment discount path. */
create or replace function public.admin_create_grant(
  p_plan text default 'monthly',
  p_days integer default 30,
  p_discount_pct integer default 0,
  p_expires timestamptz default null
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_product text := lower(trim(coalesce(p_plan, '')));
  v_days integer;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_product not in ('monthly', 'yearly', 'lifetime', 'platinum', 'auto_apply') then
    raise exception 'bad_product';
  end if;
  if p_expires is not null and p_expires <= now() then raise exception 'bad_expiry'; end if;

  v_days := case
    when p_days is not null then greatest(0, p_days)
    when v_product = 'monthly' then 30
    when v_product = 'yearly' then 365
    else 0
  end;
  /* PostgreSQL's core UUID generator supplies 122 random bits without a
     migration-time pgcrypto schema dependency. */
  v_code := 'IQGRANT-' || upper(replace(gen_random_uuid()::text, '-', ''));

  insert into public.grant_codes
    (code, plan, valid_days, discount_pct, created_by, expires_at, product, grant_days)
  values
    (v_code, v_product, greatest(1, v_days), greatest(0, least(100, p_discount_pct)),
     auth.uid(), p_expires, v_product, v_days);

  perform public.log_billing_action(
    'gift_code_created', null,
    jsonb_build_object('code', v_code, 'product', v_product, 'grant_days', v_days,
                       'expires_at', p_expires)
  );
  return v_code;
end $$;

revoke execute on function public.admin_create_grant(text, integer, integer, timestamptz) from anon, public;
grant execute on function public.admin_create_grant(text, integer, integer, timestamptz) to authenticated, service_role;

/* The row lock serializes competing redeemers. The code use, ledger insert and
   audit insert share one PostgreSQL transaction, so none can commit alone. */
drop function if exists public.redeem_grant(text);
create function public.redeem_grant(p_code text)
returns table (
  tier text, plan text, expires_at timestamptz, source text,
  discount_pct integer, discount_expires_at timestamptz,
  active boolean, is_platinum boolean, auto_apply boolean,
  issued_by uuid, updated_at timestamptz,
  paid_tier text, paid_plan text, paid_expires_at timestamptz, paid_source text,
  complimentary boolean, complimentary_grant_id bigint,
  complimentary_product text, complimentary_source text,
  complimentary_expires_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  g public.grant_codes;
  v_user uuid := auth.uid();
  v_product text;
  v_days integer;
  v_expires timestamptz;
  v_grant_id bigint;
begin
  if v_user is null then raise exception 'authentication_required'; end if;

  select * into g
  from public.grant_codes
  where code = upper(trim(p_code))
  for update;
  if not found then raise exception 'invalid_code'; end if;
  if g.used_by is not null then raise exception 'already_used'; end if;
  if g.expires_at is not null and g.expires_at <= now() then raise exception 'expired'; end if;

  v_product := coalesce(g.product,
    case when g.plan in ('monthly', 'yearly', 'lifetime', 'platinum', 'auto_apply')
         then g.plan else 'monthly' end);
  v_days := coalesce(g.grant_days, greatest(1, g.valid_days));
  v_expires := case when v_days = 0 then null
                    else now() + make_interval(days => v_days) end;

  insert into public.complimentary_grants
    (user_id, product, source, starts_at, expires_at, issued_by,
     grant_code_id, code, reason)
  values
    (v_user, v_product, 'gift_code', now(), v_expires, g.created_by,
     g.id, g.code, coalesce(nullif(btrim(g.reason), ''), 'Gift code redemption'))
  returning id into v_grant_id;

  update public.grant_codes
  set used_by = v_user, used_at = now()
  where id = g.id;

  perform public.log_billing_action(
    'gift_code_redeemed', v_user,
    jsonb_build_object('grant_id', v_grant_id, 'code', g.code,
                       'product', v_product, 'expires_at', v_expires)
  );

  return query select * from public.get_my_entitlement();
end $$;

revoke execute on function public.redeem_grant(text) from anon, public;
grant execute on function public.redeem_grant(text) to authenticated;

/* -------------------------------------------------------------------------- */
/* Terminal paid add-on writer fix                                             */
/* -------------------------------------------------------------------------- */

/* First-time add-on purchases previously evaluated NULL || jsonb to NULL. The
   terminal definition coalesces cur.addons and writes the same active/expiry
   shape consumed by has_auto_apply_access(). */
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
    new_addons := coalesce(cur.addons, '{}'::jsonb) || jsonb_build_object(
      'auto_apply', jsonb_build_object(
        'active', true, 'granted_at', now(), 'expires_at', null, 'source', p_provider
      )
    );
    new_exp := cur.expires_at;
  else
    new_addons := coalesce(cur.addons, '{}'::jsonb);
    new_exp := case when days is null then null
                    else greatest(now() + make_interval(days => days),
                                  coalesce(cur.expires_at, now() + make_interval(days => days)))
               end;
  end if;

  insert into public.payments
    (user_id, provider, provider_payment_id, plan, amount_minor, currency,
     discount_pct, status, kind)
  values
    (p_user, p_provider, p_external_id, p_plan, p_amount_minor, p_currency,
     p_discount_pct, 'paid', p_kind)
  on conflict (provider_payment_id) do nothing;

  insert into public.entitlements
    (user_id, tier, plan, expires_at, addons, source, issued_by)
  values
    (p_user,
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

  perform public.log_billing_action(
    'purchase', p_user,
    jsonb_build_object('provider', p_provider, 'external_id', p_external_id,
                       'plan', p_plan, 'kind', p_kind)
  );
end $$;

/* Legacy callers keep working, but new complimentary admin grants use the
   separate ledger above. This paid/add-on helper now shares the canonical JSON
   expiry semantics and does not create an empty row when asked to revoke one. */
create or replace function public.admin_set_addon(
  p_user uuid, p_addon text, p_on boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_addon <> 'auto_apply' then raise exception 'unknown addon'; end if;

  if p_on then
    insert into public.entitlements (user_id, tier, addons, source, issued_by)
    values (
      p_user, 'free',
      jsonb_build_object(p_addon, jsonb_build_object(
        'active', true, 'granted_at', now(), 'expires_at', null, 'source', 'admin'
      )),
      'admin', auth.uid()
    )
    on conflict (user_id) do update set
      addons = coalesce(public.entitlements.addons, '{}'::jsonb)
        || jsonb_build_object(p_addon, jsonb_build_object(
             'active', true, 'granted_at', now(), 'expires_at', null, 'source', 'admin'
           )),
      issued_by = auth.uid(),
      updated_at = now();
  else
    update public.entitlements
    set addons = coalesce(addons, '{}'::jsonb) - p_addon,
        issued_by = auth.uid(), updated_at = now()
    where user_id = p_user;
  end if;

  perform public.log_billing_action(
    case when p_on then 'addon_grant' else 'addon_revoke' end,
    p_user, jsonb_build_object('addon', p_addon)
  );
end $$;

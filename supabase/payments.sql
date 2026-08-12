/* ------------------------------------------------------------------ */
/* Payments — provider-agnostic purchase history + audit trail          */
/* ------------------------------------------------------------------ */
/* The payment gateway runs in Edge Functions (supabase/functions/pay-*)
 * and writes here with the service role after verifying the provider
 * webhook signature — the client never touches provider secrets.
 *
 * `payments` records every confirmed purchase (provider, external id,
 * plan, amount, currency, discount) so users and admins can see history.
 * `billing_actions` is the audit trail for grants/revokes/discounts/
 * codes/redeems — every entitlement change, including the SQL admin
 * RPCs below, logs who did what to whom. */

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,                -- 'razorpay' | 'stripe' | ...
  provider_payment_id text not null unique,
  plan text not null,                    -- 'monthly' | 'yearly' | 'lifetime'
  amount_minor integer not null,         -- minor units (cents / paise)
  currency text not null default 'USD',
  discount_pct integer not null default 0,
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  created_at timestamptz not null default now()
);

create table if not exists public.billing_actions (
  id bigint generated always as identity primary key,
  admin_id uuid,                          -- who acted (null = system / webhook)
  action text not null,                   -- 'grant' | 'revoke' | 'discount' | 'code' | 'redeem' | 'purchase'
  user_id uuid,                           -- the subject user
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;
alter table public.billing_actions enable row level security;

-- users read their own payments; admins read everything
create policy "payments own select" on public.payments for select using (auth.uid() = user_id);
create policy "payments admin all" on public.payments for all using (public.is_admin()) with check (public.is_admin());
create policy "billing actions admin read" on public.billing_actions for select using (public.is_admin());

-- audit helper used by the admin RPCs below
create or replace function public.log_billing_action(p_action text, p_user uuid, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.billing_actions (admin_id, action, user_id, detail)
  values (auth.uid(), p_action, p_user, p_detail);
end $$;

-- ---------------------------------------------------------------------------
-- User-facing
-- ---------------------------------------------------------------------------

/* The signed-in user's confirmed purchases, newest first. */
create or replace function public.get_my_payments()
returns table (provider text, plan text, amount_minor integer, currency text,
               discount_pct integer, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select p.provider, p.plan, p.amount_minor, p.currency, p.discount_pct, p.status, p.created_at
    from public.payments p
    where p.user_id = auth.uid()
    order by p.created_at desc;
end $$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

/* Every confirmed purchase across all users (emails for the dashboard). */
create or replace function public.admin_list_payments()
returns table (user_id uuid, email text, provider text, plan text, amount_minor integer,
               currency text, discount_pct integer, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.user_id, pr.email, p.provider, p.plan, p.amount_minor, p.currency,
           p.discount_pct, p.status, p.created_at
    from public.payments p
    left join public.profiles pr on pr.id = p.user_id
    order by p.created_at desc;
end $$;

/* The billing audit trail — every grant/revoke/discount/code/redeem/purchase. */
create or replace function public.admin_billing_actions(max_rows integer default 50)
returns table (action text, admin_id uuid, user_id uuid, email text, detail jsonb, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select b.action, b.admin_id, b.user_id, pr.email, b.detail, b.created_at
    from public.billing_actions b
    left join public.profiles pr on pr.id = b.user_id
    order by b.created_at desc
    limit max_rows;
end $$;

-- ---------------------------------------------------------------------------
-- Audit logging in the existing entitlement RPCs (recreated, same signatures)
-- ---------------------------------------------------------------------------

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
  perform public.log_billing_action(case when p_tier = 'free' then 'revoke' else 'grant' end, p_user,
    jsonb_build_object('plan', p_plan, 'expires', p_expires, 'source', p_source));
end $$;

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
  perform public.log_billing_action('discount', p_user, jsonb_build_object('pct', p_pct, 'days', p_days));
end $$;

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
  perform public.log_billing_action('code', null, jsonb_build_object('plan', p_plan, 'days', p_days, 'discount_pct', p_discount_pct));
  return code;
end $$;

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
  perform public.log_billing_action('redeem', auth.uid(), jsonb_build_object('code', g.code, 'plan', g.plan));

  return query
    select e.tier, e.plan, e.expires_at, e.source, e.discount_pct, e.discount_expires_at,
           (e.tier = 'pro' and (e.expires_at is null or e.expires_at > now())) as active
    from public.entitlements e where e.user_id = auth.uid();
end $$;

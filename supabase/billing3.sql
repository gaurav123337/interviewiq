/* ------------------------------------------------------------------ */
/* Billing core v3 — subscriptions + coupon codes                       */
/* ------------------------------------------------------------------ */
/* `subscriptions` tracks the provider subscription entity (created at
 * checkout, refreshed on every subscription.charged, marked cancelled on
 * subscription.cancelled or a user-initiated cancel via the pay-cancel
 * Edge Function). Access continues until current_period_end — cancelling
 * stops future billing, not current access.
 *
 * `coupons` are reusable discount codes (LAUNCH20…). validate_coupon is a
 * read-only check for the storefront; consume_coupon increments usage and
 * is ONLY callable by the webhook (service role) after a payment confirms,
 * so an abandoned checkout never burns a use. */

create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,                     -- 'razorpay' | 'stripe' | ...
  provider_subscription_id text not null unique,
  plan text not null,                         -- 'monthly' | 'yearly'
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id bigint generated always as identity primary key,
  code text not null unique,                  -- upper-cased at creation
  discount_pct integer not null check (discount_pct between 1 and 100),
  max_uses integer not null default 0,        -- 0 = unlimited
  used_count integer not null default 0,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
alter table public.coupons enable row level security;

-- users read their own subscription; admins read everything
drop policy if exists "subscriptions own select" on public.subscriptions;
drop policy if exists "subscriptions admin all" on public.subscriptions;
create policy "subscriptions own select" on public.subscriptions for select using (auth.uid() = user_id);
create policy "subscriptions admin all" on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());
-- coupons are admin-managed; validation goes through validate_coupon (security definer)
drop policy if exists "coupons admin all" on public.coupons;
create policy "coupons admin all" on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------

/* Create / refresh / cancel a subscription row. Gated to admins AND the
   service role so the webhook (verified payment events) and the pay-cancel
   function (verified ownership + provider API) share one code path. */
create or replace function public.upsert_subscription(
  p_user uuid, p_provider text, p_provider_sub_id text, p_plan text,
  p_status text, p_period_end timestamptz default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_status not in ('active', 'cancelled', 'expired') then raise exception 'bad status'; end if;

  insert into public.subscriptions (user_id, provider, provider_subscription_id, plan, status, current_period_end)
  values (p_user, p_provider, p_provider_sub_id, p_plan, p_status, p_period_end)
  on conflict (provider_subscription_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
    cancelled_at = case when excluded.status = 'cancelled' then coalesce(public.subscriptions.cancelled_at, now()) else public.subscriptions.cancelled_at end,
    updated_at = now();

  if p_status = 'cancelled' then
    perform public.log_billing_action('cancel_sub', p_user,
      jsonb_build_object('provider', p_provider, 'sub', p_provider_sub_id, 'plan', p_plan));
  end if;
end $$;

/* The signed-in user's latest subscription (next billing date + status). */
create or replace function public.get_my_subscription()
returns table (provider text, provider_subscription_id text, plan text, status text,
               current_period_end timestamptz, cancelled_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select s.provider, s.provider_subscription_id, s.plan, s.status, s.current_period_end, s.cancelled_at, s.created_at
    from public.subscriptions s
    where s.user_id = auth.uid()
    order by s.created_at desc
    limit 1;
end $$;

/* Admin: every subscription across users. */
create or replace function public.admin_list_subscriptions()
returns table (user_id uuid, email text, provider text, provider_subscription_id text, plan text,
               status text, current_period_end timestamptz, cancelled_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select s.user_id, pr.email, s.provider, s.provider_subscription_id, s.plan, s.status,
           s.current_period_end, s.cancelled_at, s.created_at
    from public.subscriptions s
    left join public.profiles pr on pr.id = s.user_id
    order by s.created_at desc;
end $$;

-- ---------------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------------

/* Read-only storefront check — the Upgrade modal calls this to show the
   discount before checkout. Never increments usage. */
create or replace function public.validate_coupon(p_code text)
returns table (code text, discount_pct integer, valid boolean, message text)
language plpgsql security definer set search_path = public as $$
declare c public.coupons;
begin
  /* alias the table so the OUT column `code` can't shadow the column */
  select * into c from public.coupons x where x.code = upper(trim(p_code));
  if c is null then
    return query select upper(trim(p_code)), 0, false, 'Unknown code'; return;
  end if;
  if c.max_uses > 0 and c.used_count >= c.max_uses then
    return query select c.code, 0, false, 'Code fully used'; return;
  end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return query select c.code, 0, false, 'Code expired'; return;
  end if;
  return query select c.code, c.discount_pct, true, 'ok';
end $$;

/* Consume a coupon at CONFIRMED-payment time (webhook, service role).
   Returns the discount percent. Only fires once per payment — the webhook
   guards with the payment-id idempotency check before calling. */
create or replace function public.consume_coupon(p_code text)
returns integer language plpgsql security definer set search_path = public as $$
declare c public.coupons; pct integer;
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  select * into c from public.coupons x where x.code = upper(trim(p_code));
  if c is null then raise exception 'invalid_code'; end if;
  if c.max_uses > 0 and c.used_count >= c.max_uses then raise exception 'code_fully_used'; end if;
  if c.expires_at is not null and c.expires_at <= now() then raise exception 'code_expired'; end if;
  update public.coupons set used_count = used_count + 1 where id = c.id;
  pct := c.discount_pct;
  return pct;
end $$;

/* Admin: create a reusable coupon code. Returns the normalized code. */
create or replace function public.admin_create_coupon(
  p_code text, p_discount_pct integer, p_max_uses integer default 0,
  p_expires_at timestamptz default null
)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_discount_pct < 1 or p_discount_pct > 100 then raise exception 'bad pct'; end if;
  code := upper(trim(p_code));
  insert into public.coupons (code, discount_pct, max_uses, expires_at, created_by)
  values (code, p_discount_pct, greatest(0, p_max_uses), p_expires_at, auth.uid());
  perform public.log_billing_action('coupon', null,
    jsonb_build_object('code', code, 'pct', p_discount_pct, 'max_uses', p_max_uses, 'expires', p_expires_at));
  return code;
end $$;

/* Admin: all coupons with usage. */
create or replace function public.admin_list_coupons()
returns table (code text, discount_pct integer, max_uses integer, used_count integer,
               expires_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select c.code, c.discount_pct, c.max_uses, c.used_count, c.expires_at, c.created_at
    from public.coupons c
    order by c.created_at desc;
end $$;

/* ------------------------------------------------------------------ */
/* Billing core v2 — single-source grant/refund logic                   */
/* ------------------------------------------------------------------ */
/* apply_purchase / apply_refund are the ONLY places entitlement state
 * changes for paid transactions. Both are gated to admins OR the service
 * role, so the webhook (service role, after signature verification) and the
 * admin dashboard (is_admin) funnel through identical logic — a simulated
 * purchase and a real Razorpay payment are indistinguishable. */

alter table public.payments add column if not exists kind text not null default 'one_time';

-- plan → days (mirror of the provider core's PLAN_CATALOG)
create or replace function public.plan_days(p_plan text)
returns integer language sql immutable as $$
  select case p_plan when 'monthly' then 30 when 'yearly' then 365 else null end;
$$;

/* Grant / extend Pro for a confirmed purchase (paid once or a subscription
   renewal). Extends from the current expiry — renewals don't stack. */
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
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if days is null and p_plan <> 'lifetime' then
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
  values (p_user, 'pro', p_plan, new_exp, p_provider, auth.uid())
  on conflict (user_id) do update set
    tier = 'pro',
    plan = excluded.plan,
    expires_at = excluded.expires_at,
    source = excluded.source,
    issued_by = excluded.issued_by,
    updated_at = now();

  insert into public.billing_actions (admin_id, action, user_id, detail)
  values (auth.uid(), 'purchase', p_user,
          jsonb_build_object('provider', p_provider, 'external_id', p_external_id, 'plan', p_plan, 'kind', p_kind));
end $$;

/* Refund a confirmed payment: marks it refunded and subtracts the plan's
   days from the entitlement (clamped at now; lifetime → expires now).
   `p_reason` is carried into the audit trail so every refund has a paper
   trail, mirroring cancel-with-reason. */
create or replace function public.apply_refund(p_provider_payment_id text, p_reason text default null)
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
  if ent is not null and ent.expires_at is not null then
    days := public.plan_days(pay.plan);
    new_exp := case when days is null then now()
                    else greatest(now(), ent.expires_at - (days || ' days')::interval)
               end;
    update public.entitlements
      set expires_at = new_exp, updated_at = now()
      where user_id = pay.user_id;
  end if;

  insert into public.billing_actions (admin_id, action, user_id, detail)
  values (auth.uid(), 'refund', pay.user_id,
          jsonb_build_object('provider', pay.provider, 'external_id', p_provider_payment_id, 'plan', pay.plan)
            || case when p_reason is not null and btrim(p_reason) <> ''
                    then jsonb_build_object('reason', btrim(left(p_reason, 200))) else '{}'::jsonb end);
end $$;

/* Admin: refund a payment from the dashboard. */
create or replace function public.admin_refund_payment(p_provider_payment_id text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  perform public.apply_refund(p_provider_payment_id, p_reason);
end $$;

/* Admin: simulate a confirmed purchase (the test path — exercises the exact
   same apply_purchase grant as a real webhook). */
create or replace function public.admin_simulate_purchase(
  p_user uuid, p_plan text, p_amount_minor integer default null,
  p_currency text default 'USD', p_discount_pct integer default 0, p_kind text default 'one_time'
)
returns text language plpgsql security definer set search_path = public as $$
declare
  ext text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  ext := 'SIM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
  perform public.apply_purchase(
    p_user, 'test', ext, p_plan,
    coalesce(p_amount_minor, case p_plan when 'monthly' then 900 when 'yearly' then 7900 when 'lifetime' then 19900 else 0 end),
    p_currency, p_discount_pct, p_kind);
  return ext;
end $$;

/* Recreate the payment-listing RPCs to include kind (one_time/subscription)
   and provider_payment_id (needed for admin refunds). Return types changed,
   so drop first (create or replace can't alter OUT params). */
drop function if exists public.get_my_payments();
drop function if exists public.admin_list_payments();

create or replace function public.get_my_payments()
returns table (provider text, plan text, amount_minor integer, currency text,
               discount_pct integer, status text, kind text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select p.provider, p.plan, p.amount_minor, p.currency, p.discount_pct, p.status, p.kind, p.created_at
    from public.payments p
    where p.user_id = auth.uid()
    order by p.created_at desc;
end $$;

create or replace function public.admin_list_payments()
returns table (user_id uuid, email text, provider text, provider_payment_id text, plan text,
               amount_minor integer, currency text, discount_pct integer, status text, kind text,
               created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.user_id, pr.email, p.provider, p.provider_payment_id, p.plan, p.amount_minor,
           p.currency, p.discount_pct, p.status, p.kind, p.created_at
    from public.payments p
    left join public.profiles pr on pr.id = p.user_id
    order by p.created_at desc;
end $$;

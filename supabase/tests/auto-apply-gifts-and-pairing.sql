-- Disposable database assertions; never grants access to a real user.
begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare g bigint; c text; begin
  g := public.admin_grant_complimentary('33333333-3333-4333-8333-333333333333','platinum',now()+interval '3 days','Test gift');
  perform public.admin_revoke_complimentary(g,'Test revoke');
  if not exists(select 1 from public.get_my_entitlement()) then raise exception 'effective reader missing'; end if;
  c := public.admin_create_grant('auto_apply',0,0,now()+interval '1 day');
  perform set_config('test.gift_code',c,true);
end $$;
reset role;
do $$ begin
  if (select tier from public.entitlements where user_id='33333333-3333-4333-8333-333333333333') <> 'platinum' then raise exception 'gift revoke removed paid plan'; end if;
  if exists(select 1 from public.payments) then raise exception 'gift created payment'; end if;
end $$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
set local role authenticated;
do $$ declare e record; reused boolean := false; begin
  select * into e from public.redeem_grant(current_setting('test.gift_code'));
  if e.auto_apply <> true or e.active <> false or e.tier <> 'free' then raise exception 'free add-on gift changed plan or failed'; end if;
  begin perform public.redeem_grant(current_setting('test.gift_code')); exception when others then reused := true; end;
  if not reused then raise exception 'gift code reused'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.payments) then raise exception 'gift redemption created payment'; end if;
  if exists(select 1 from public.entitlements where user_id='44444444-4444-4444-8444-444444444444') then raise exception 'gift overwrote paid ledger'; end if;
end $$;

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
do $$ declare issued uuid; exchanged record; reused record; revoked boolean; denied boolean := false; begin
  issued := public.service_apply_agent_issue_code('44444444-4444-4444-8444-444444444444', repeat('a',64), clock_timestamp()+interval '5 minutes');
  select * into exchanged from public.service_apply_agent_exchange_code(repeat('a',64),'aaaaaaaa-1111-4111-8111-111111111111',repeat('b',64),'Test agent');
  if exchanged.owner_id <> '44444444-4444-4444-8444-444444444444' then raise exception 'pair owner mismatch'; end if;
  select * into reused from public.service_apply_agent_exchange_code(repeat('a',64),'aaaaaaaa-2222-4222-8222-222222222222',repeat('c',64),'Replay');
  if found then raise exception 'pairing code reused'; end if;
  perform public.service_apply_agent_dispatch('aaaaaaaa-1111-4111-8111-111111111111',repeat('b',64),'results.list','{}');
  begin
    perform public.service_apply_agent_dispatch('aaaaaaaa-1111-4111-8111-111111111111',repeat('c',64),'results.list','{}');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'wrong binding digest admitted'; end if;
  denied := false;
  revoked := public.service_apply_agent_revoke_binding('22222222-2222-4222-8222-222222222222','aaaaaaaa-1111-4111-8111-111111111111');
  if revoked then raise exception 'cross-user binding revoke'; end if;
  revoked := public.service_apply_agent_revoke_binding('44444444-4444-4444-8444-444444444444','aaaaaaaa-1111-4111-8111-111111111111');
  if not revoked then raise exception 'own revoke failed'; end if;
  begin
    perform public.service_apply_agent_dispatch('aaaaaaaa-1111-4111-8111-111111111111',repeat('b',64),'results.list','{}');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'revoked binding reached data action'; end if;
  if not public.service_apply_agent_rate_limit('agent_action',repeat('d',64),1,60) then raise exception 'first limit denied'; end if;
  if public.service_apply_agent_rate_limit('agent_action',repeat('d',64),1,60) then raise exception 'rate limit not enforced'; end if;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from public.apply_agent_bindings where id='aaaaaaaa-1111-4111-8111-111111111111' and revoked_at is not null) then raise exception 'binding revocation missing'; end if;
end $$;
rollback;

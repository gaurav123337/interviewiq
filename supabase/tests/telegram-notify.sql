-- Disposable tenant test database only, after migration replay. No Telegram HTTP.
begin;
-- Simulate old bindings without marking them tested; arbitrary old tokens still
-- remain usable by the service reader (new saves have stricter boundary checks).
insert into public.user_notify_config(user_id,chat_id,bot_token,updated_at)
values ('22222222-2222-4222-8222-222222222222','123456789','123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd','2026-10-01T00:00:00Z'),
       ('33333333-3333-4333-8333-333333333333','987654321','987654:ABCDEFGHIJKLMNOPQRSTUVWX_wxyz','2026-10-02T00:00:00Z');

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
do $$ declare a uuid := '22222222-2222-4222-8222-222222222222'; b uuid := '33333333-3333-4333-8333-333333333333';
  f uuid := '44444444-4444-4444-8444-444444444444'; r jsonb; old jsonb; i integer;
begin
  r := public.notify_binding_action(a,'read','{}');
  if r->>'bot_token' <> '123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd' or r->'config'->>'chat_id' <> '123456789'
    or r->'config'->>'delivery_tested_at' is not null or (r->'config'->>'revision')::bigint <> 0
    or r->'config'->>'time_zone' <> 'UTC' then raise exception 'old binding changed'; end if;
  r := public.apply_agent_action(a,'notify.get','{}');
  if r->>'chat_id' <> '123456789' or r->>'bot_token' <> '123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd'
    or r->>'time_zone' <> 'UTC' then raise exception 'engine old binding incompatible'; end if;
  old := public.notify_binding_action(a,'read','{}');
  -- Invalid input/fake browser delivery metadata and stale revision never replace an old row.
  r := public.notify_binding_action(a,'save','{"revision":0,"chatId":"123","botToken":"bad","timeZone":"UTC"}');
  if r->>'reason' <> 'invalid_settings' then raise exception 'bad token admitted'; end if;
  r := public.notify_binding_action(a,'save','{"revision":0,"chatId":"123","botToken":"123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd","timeZone":"UTC","delivery_tested_at":"2000-01-01"}');
  if r->>'reason' <> 'invalid_settings' then raise exception 'forged delivery timestamp admitted'; end if;
  r := public.notify_binding_action(a,'save','{"revision":8,"chatId":"123","botToken":"123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd","timeZone":"UTC"}');
  if r->>'reason' <> 'stale_binding' then raise exception 'stale save admitted'; end if;
  r := public.notify_binding_action(a,'test','{"revision":0,"userId":"33333333-3333-4333-8333-333333333333"}');
  if r->>'reason' <> 'invalid_settings' then raise exception 'JSON owner admitted'; end if;
  if public.notify_binding_action(a,'read','{}') is distinct from old then raise exception 'failed operation overwrote old binding'; end if;

  r := public.notify_binding_action(a,'save','{"revision":0,"chatId":"-100123456789","botToken":"","timeZone":"Asia/Kolkata"}');
  if r->>'ok' <> 'true' or r->'config'->>'delivery_tested_at' is null
    or (r->'config'->>'revision')::bigint <> 1 or r->'config' ? 'bot_token' then raise exception 'tested save metadata wrong'; end if;
  if public.notify_binding_action(a,'read','{}')->>'bot_token' <> '123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd' then
    raise exception 'blank token did not reuse stored secret'; end if;
  r := public.notify_binding_action(a,'test','{"revision":0}');
  if r->>'reason' <> 'stale_binding' then raise exception 'stale test changed new binding'; end if;
  r := public.notify_binding_action(a,'test','{"revision":1}');
  if r->>'ok' <> 'true' or (r->'config'->>'revision')::bigint <> 2 then raise exception 'test CAS failed'; end if;
  r := public.notify_binding_action(a,'unbind','{"revision":2}');
  if r->>'ok' <> 'true' or r->'config'->>'chat_id' is not null or r->'config'->>'has_token' <> 'false'
    or r->'config'->>'delivery_tested_at' is not null or (r->'config'->>'revision')::bigint <> 3 then raise exception 'unbind not tombstone'; end if;
  r := public.notify_binding_action(a,'save','{"revision":2,"chatId":"123","botToken":"123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd","timeZone":"UTC"}');
  if r->>'reason' <> 'stale_binding' then raise exception 'inflight send resurrected unbound connection'; end if;
  r := public.notify_binding_action(b,'read','{}');
  if r->'config'->>'chat_id' <> '987654321' or (r->'config'->>'revision')::bigint <> 0
    or r->'config'->>'delivery_tested_at' is not null then raise exception 'binding crossed users'; end if;

  -- Shared persisted rate limits both failed/successful sends across edge isolates.
  for i in 1..5 loop
    r := public.notify_binding_action(b,'claim','{"revision":0}');
    if r->>'ok' <> 'true' then raise exception 'rate rejected too early'; end if;
  end loop;
  r := public.notify_binding_action(b,'claim','{"revision":0}');
  if r->>'reason' <> 'rate_limited' then raise exception 'sixth send not rate limited'; end if;
  r := public.notify_binding_action(b,'unbind','{"revision":0}');
  if r->>'ok' <> 'true' then raise exception 'rate blocked cleanup'; end if;

  -- Expired/unpaid signed-in owners can disconnect an absent row, not test/save.
  r := public.notify_binding_action(f,'unbind','{"revision":null}');
  if r->>'ok' <> 'true' or (r->'config'->>'revision')::bigint <> 1 then raise exception 'unpaid cleanup blocked'; end if;
  r := public.notify_binding_action(f,'save','{"revision":1,"chatId":"123","botToken":"123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd","timeZone":"UTC"}');
  if r->>'reason' <> 'not_entitled' then raise exception 'unpaid save admitted'; end if;
  r := public.notify_binding_action(f,'test','{"revision":1}');
  if r->>'reason' <> 'not_entitled' then raise exception 'unpaid test admitted'; end if;
end $$;
reset role;

-- Missing-row CAS is distinct from old revision0. Two initial completions using
-- the same absent revision cannot overwrite one another; owner lock also covers
-- truly concurrent transactions (this sequential replay tests their final CAS).
insert into auth.users(id,email) values ('55555555-5555-4555-8555-555555555555','telegram-cas@example.test');
insert into public.entitlements(user_id,tier,addons) values ('55555555-5555-4555-8555-555555555555','free','{"auto_apply":{"expires_at":null}}');
set local role service_role;
do $$ declare u uuid := '55555555-5555-4555-8555-555555555555'; r jsonb; begin
  r := public.notify_binding_action(u,'read','{}');
  if r->'config' <> 'null'::jsonb then raise exception 'absent metadata not null'; end if;
  r := public.notify_binding_action(u,'save','{"revision":0,"chatId":"123","botToken":"123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd","timeZone":"UTC"}');
  if r->>'reason' <> 'stale_binding' then raise exception 'absent row confused with revision0'; end if;
  r := public.notify_binding_action(u,'save','{"revision":null,"chatId":"123","botToken":"123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd","timeZone":"UTC"}');
  if r->>'ok' <> 'true' then raise exception 'first save failed'; end if;
  r := public.notify_binding_action(u,'save','{"revision":null,"chatId":"456","botToken":"123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd","timeZone":"UTC"}');
  if r->>'reason' <> 'stale_binding' then raise exception 'two absent saves admitted'; end if;
  r := public.notify_binding_action(u,'read','{}');
  if r->'config'->>'chat_id' <> '123' then raise exception 'second save overwrote first'; end if;
end $$;
reset role;

-- Preserve legacy created_at backfill and stable duplicate event occurrence.
do $$ begin
  if exists(select 1 from public.apply_results where occurred_at is distinct from created_at) then
    raise exception 'historical timestamp changed during migration'; end if;
end $$;
set local role service_role;
select public.apply_agent_action('22222222-2222-4222-8222-222222222222','results.record',
  '{"siteHost":"timestamp.test","jobUrl":"https://timestamp.test/job","title":"first","result":"filtered","eventId":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","occurredAt":"2026-09-01T10:12:13.123Z"}');
select public.apply_agent_action('22222222-2222-4222-8222-222222222222','results.record',
  '{"siteHost":"timestamp.test","jobUrl":"https://timestamp.test/job","title":"duplicate","result":"filtered","eventId":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","occurredAt":"2026-10-01T10:12:13.123Z"}');
select public.apply_agent_action('33333333-3333-4333-8333-333333333333','results.record',
  '{"siteHost":"timestamp.test","jobUrl":"https://timestamp.test/job","title":"B","result":"filtered","eventId":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","occurredAt":"2026-08-01T10:12:13.123Z"}');
reset role;
do $$ begin
  if (select count(*) from public.apply_results where user_id='22222222-2222-4222-8222-222222222222') <> 1 then raise exception 'duplicate event inserted'; end if;
  if not exists(select 1 from public.apply_results where user_id='22222222-2222-4222-8222-222222222222'
    and title='first' and occurred_at='2026-09-01T10:12:13.123Z' and created_at <> occurred_at) then raise exception 'duplicate timestamp overwritten'; end if;
  if not exists(select 1 from public.apply_results where user_id='33333333-3333-4333-8333-333333333333'
    and title='B' and occurred_at='2026-08-01T10:12:13.123Z') then raise exception 'event crossed tenant'; end if;
end $$;

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
set local role authenticated;
do $$ declare r jsonb; denied boolean; begin
  r := public.get_my_notify_config();
  if r->>'chat_id' <> '123' or r->>'has_token' <> 'true' or r ? 'bot_token' then raise exception 'metadata leaks/wrong owner'; end if;
  denied := false;
  begin perform bot_token from public.user_notify_config; exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'browser token select admitted'; end if;
  denied := false;
  begin update public.user_notify_config set delivery_tested_at=now(); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'browser forged tested timestamp'; end if;
  denied := false;
  begin insert into public.user_notify_config(user_id,chat_id) values(auth.uid(),'456'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'browser direct insert admitted'; end if;
  denied := false;
  begin delete from public.user_notify_config; exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'browser deletion admitted'; end if;
  denied := false;
  begin perform public.notify_binding_action(auth.uid(),'test','{"revision":1}'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'browser can assert successful send'; end if;
  denied := false;
  begin perform public.notify_binding_metadata('22222222-2222-4222-8222-222222222222'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'browser arbitrary-owner metadata admitted'; end if;
  begin
    perform public.admin_clear_user_notify('22222222-2222-4222-8222-222222222222');
    raise exception 'nonadmin cleanup admitted';
  exception when others then if sqlerrm <> 'forbidden' then raise; end if; end;
  denied := false;
  begin perform public.apply_core_action(auth.uid(),'notify.get','{}'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'browser core token reader admitted'; end if;
  denied := false;
  begin perform public.apply_core_action_telegram_base(auth.uid(),'notify.get','{}'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'browser base token reader admitted'; end if;
  begin
    perform public.my_apply_action('notify.get','{}');
    raise exception 'self-service token reader admitted';
  exception when others then if sqlerrm <> 'unsupported self-service action' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ declare r jsonb; begin
  r := public.my_apply_action('results.list','{}');
  if jsonb_array_length(r) <> 1 or r->0->>'title' <> 'first' or r->0->>'occurred_at' is null then raise exception 'timestamp history reader regression'; end if;
end $$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$ declare r jsonb; begin
  r := public.get_my_notify_config();
  if r->>'has_token' <> 'false' or (r->>'revision')::bigint <> 1 then raise exception 'unpaid metadata read blocked'; end if;
end $$;
reset role;
-- A genuine admin cleanup during an in-flight send retains the same CAS barrier.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.admin_clear_user_notify('55555555-5555-4555-8555-555555555555');
reset role;
do $$ begin
  if not exists(select 1 from public.user_notify_config where user_id='55555555-5555-4555-8555-555555555555'
    and revision=2 and chat_id is null and bot_token is null and delivery_tested_at is null) then
    raise exception 'admin cleanup deleted or did not increment tombstone';
  end if;
end $$;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
do $$ declare r jsonb; begin
  r := public.notify_binding_action('55555555-5555-4555-8555-555555555555','save',
    '{"revision":1,"chatId":"123","botToken":"123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd","timeZone":"UTC"}');
  if r->>'reason' <> 'stale_binding' then raise exception 'admin clear allowed stale resurrection'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
set local role anon;
do $$ declare denied boolean := false; begin
  begin perform public.get_my_notify_config(); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'anonymous metadata admitted'; end if;
end $$;
reset role;
rollback;

-- Run only in the disposable auto-apply test database. Raises on any leak.
begin;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select public.apply_agent_action('22222222-2222-4222-8222-222222222222','results.record','{"siteHost":"same.test","jobUrl":"https://same.test/job","title":"A private","result":"budget_capped","eventId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}');
select public.apply_agent_action('22222222-2222-4222-8222-222222222222','results.record','{"siteHost":"same.test","jobUrl":"https://same.test/job","title":"retry","result":"budget_capped","eventId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}');
select public.apply_agent_action('33333333-3333-4333-8333-333333333333','results.record','{"siteHost":"same.test","jobUrl":"https://same.test/job","title":"B private","result":"filtered"}');
select public.apply_agent_action('22222222-2222-4222-8222-222222222222','reviews.queue','{"siteHost":"same.test","jobUrl":"https://same.test/job","title":"A review"}');
select public.apply_agent_action('33333333-3333-4333-8333-333333333333','reviews.queue','{"siteHost":"same.test","jobUrl":"https://same.test/job","title":"B review"}');
select public.apply_agent_action('22222222-2222-4222-8222-222222222222','variants.put','{"jobUrl":"https://same.test/job","variantId":"same-hash","variantText":"A resume"}');
select public.apply_agent_action('33333333-3333-4333-8333-333333333333','variants.put','{"jobUrl":"https://same.test/job","variantId":"same-hash","variantText":"B resume"}');
select public.apply_agent_action('22222222-2222-4222-8222-222222222222','memory.put','{"siteHost":"same.test","fieldKey":"name","answer":"A"}');
select public.apply_agent_action('33333333-3333-4333-8333-333333333333','memory.put','{"siteHost":"same.test","fieldKey":"name","answer":"B"}');
reset role;

do $$ begin
  if (select count(*) from apply_results where user_id='22222222-2222-4222-8222-222222222222') <> 1 then raise exception 'event retry duplicated'; end if;
  if (select count(*) from apply_results where user_id='11111111-1111-4111-8111-111111111111') <> 1 then raise exception 'legacy count changed'; end if;
end $$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare rows jsonb; denied boolean := false; begin
  rows := public.my_apply_action('results.list');
  if jsonb_array_length(rows) <> 1 or rows->0->>'title' <> 'A private' then raise exception 'results leak'; end if;
  rows := public.my_apply_action('reviews.list');
  if jsonb_array_length(rows) <> 1 or rows->0->>'title' <> 'A review' then raise exception 'reviews leak'; end if;
  perform public.my_apply_action('reviews.resolve',jsonb_build_object('id', rows->0->>'id','status','done'));
  rows := public.my_apply_action('variants.list');
  if jsonb_array_length(rows) <> 1 or rows->0->>'variant_text' <> 'A resume' then raise exception 'variants leak'; end if;
  begin
    perform public.my_apply_action('variants.approve',jsonb_build_object('id', rows->0->>'id'));
    raise exception 'missing approved value admitted';
  exception when others then
    if sqlerrm <> 'approved must be boolean' then raise; end if;
  end;
  if (select count(*) from public.apply_results) <> 1 then raise exception 'RLS leak'; end if;
  begin perform public.apply_agent_action('33333333-3333-4333-8333-333333333333','results.list','{}'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'authenticated caller reached service dispatcher'; end if;
end $$;
reset role;
do $$ begin
  if (select status from public.job_apply_reviews where user_id='33333333-3333-4333-8333-333333333333') <> 'pending' then raise exception 'resolve crossed user boundary'; end if;
end $$;

select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
set local role authenticated;
do $$ declare denied boolean := false; begin
  if public.my_apply_action('results.list') <> '[]'::jsonb then raise exception 'free history leak'; end if;
  begin perform public.my_apply_action('exemplars.put','{"kind":"positive","summary":"unpaid"}'); exception when others then denied := true; end;
  if not denied then raise exception 'free write admitted'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ declare denied boolean := false; begin
  begin perform public.my_apply_action('results.list'); exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'anonymous sensitive read admitted'; end if;
end $$;
reset role;
rollback;

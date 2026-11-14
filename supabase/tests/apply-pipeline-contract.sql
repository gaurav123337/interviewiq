-- Own-auth, immutable profiles, scoped answers, bounded feeds and native bindings.
begin;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare v jsonb; p jsonb; s jsonb; begin
  perform public.test_apply_pipeline_assert(not has_table_privilege('authenticated','public.apply_verified_answers','select'),'private answers are RPC-only');
  perform public.test_apply_pipeline_assert(not has_function_privilege('authenticated','public.apply_pipeline_action(uuid,uuid,text,jsonb)','execute'),'internal owner dispatcher inaccessible');
  perform public.test_apply_pipeline_assert(not has_function_privilege('authenticated','public.service_apply_pipeline_dispatch(uuid,text,text,jsonb)','execute'),'browser cannot execute service dispatcher');
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('profile.confirm','{"expectedRevision":null,"facts":{"name":{"value":"private A","source":"ai"}},"resumeText":"Exact resume","resumeApproved":true}')$q$);
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('profile.confirm','{"expectedRevision":null,"facts":{"workAuthorization":{"value":true,"source":"user"}},"resumeText":"Exact resume","resumeApproved":true}')$q$);
  p:=public.my_apply_pipeline_action('profile.confirm','{"expectedRevision":null,"facts":{"name":{"value":"private A","source":"user"},"skills":{"value":["typescript","sql"],"source":"user"},"role":{"value":"Software Engineer","source":"user"},"locations":{"value":["Remote"],"source":"user"},"skillYears:node.js":{"value":3,"source":"user"},"workAuthorization":{"value":true,"source":"user","scope":{"country":"US"}}},"resumeText":"Exact user-approved resume A","resumeApproved":true}');
  perform public.test_apply_pipeline_assert(p->'profile'->>'revision'='1' and p->'profile'->'facts'->'name'->>'confirmedAt' ~ 'Z$','server stamps canonical confirmed time');
  perform public.test_apply_pipeline_assert(not p->'profile' ? 'user_id','profile hides authoritative owner');
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('profile.confirm','{"expectedRevision":null,"facts":{},"resumeText":"","resumeApproved":false}')$q$);
  s:=public.my_apply_pipeline_action('settings.get','{}');
  perform public.test_apply_pipeline_assert(s->'settings'->'data'->>'enabled'='false' and s->'settings'->'data'->>'autoSubmit'='false','autonomy is opt-in by default');
  s:=public.my_apply_pipeline_action('settings.put',jsonb_build_object('expectedRevision',1,'settings',(s->'settings'->'data')||'{"enabled":true,"autoSubmit":true,"roles":["Software Engineer"],"locations":["Remote"],"dailyCap":10,"weeklyCap":50,"employerDailyCap":2}'));
  perform public.test_apply_pipeline_assert(s->'settings'->>'revision'='2','settings increments revision');
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('settings.put','{"expectedRevision":2,"settings":{"enabled":true}}')$q$);
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('run.request','{"bindingId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","mode":"auto"}')$q$);
  v:=public.my_apply_pipeline_action('run.request','{"bindingId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","mode":"auto","limit":10}');
  perform public.test_apply_pipeline_assert(v->'run'->>'binding_id'='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and v->'run'->>'task_count'='5','run now builds public-job snapshots without Telegram');
  v:=public.my_apply_pipeline_action('tasks.list','{}');
  perform public.test_apply_pipeline_assert(jsonb_array_length(v->'tasks')=5,'job-first queue exists');
  perform public.test_apply_pipeline_assert(not exists(select 1 from jsonb_array_elements(v->'tasks') x where x ? 'lease_nonce' or x ? 'user_id'),'browser queue omits owner and fencing nonce');
  perform public.test_apply_pipeline_assert(exists(select 1 from jsonb_array_elements(v->'tasks') x where x->>'status'='filtered'),'hard filter verdict remains visible');
  perform public.test_apply_pipeline_assert(public.my_apply_pipeline_action('answers.list','{}')->'answers'='[]'::jsonb,'legacy memory never automatically trusted');
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('jobs.ingest','{}')$q$);
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('profile.get','{"userId":"33333333-3333-4333-8333-333333333333"}')$q$);
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('boards.add','{"url":"https://127.0.0.1/jobs"}')$q$);
end $$;
reset role;
-- B cannot see A's facts, queue or boards; platform admin is also own-only.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
set local role authenticated;
do $$ begin
  perform public.test_apply_pipeline_assert(public.my_apply_pipeline_action('profile.get','{}')->'profile'='null'::jsonb,'B has no A profile');
  perform public.test_apply_pipeline_assert(public.my_apply_pipeline_action('tasks.list','{}')->'tasks'='[]'::jsonb,'B has no A queue');
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$ begin
  perform public.test_apply_pipeline_assert(public.my_apply_pipeline_action('tasks.list','{}')->'tasks'='[]'::jsonb,'admin cannot override private queue');
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
do $$ declare v jsonb; begin
  perform public.test_apply_pipeline_denied($q$select public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('b',64),'profile.get','{}')$q$);
  perform public.test_apply_pipeline_denied($q$select public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'settings.put','{}')$q$);
  perform public.test_apply_pipeline_denied($q$select public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'agent.heartbeat','{"engineVersion":"proof","capabilities":[],"status":"ready","profileMetadata":{"cookies":"sensitive"}}')$q$);
  v:=public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'agent.heartbeat','{"engineVersion":"proof","capabilities":["verified_bank"],"status":"ready","profileMetadata":{"revision":1,"resumeApproved":true}}');
  v:=public.service_apply_pipeline_dispatch('cccccccc-cccc-4ccc-8ccc-cccccccccccc',repeat('c',64),'tasks.claim','{"limit":10}');
  perform public.test_apply_pipeline_assert(v->'tasks'='[]'::jsonb,'other own binding cannot steal selected-machine tasks');
  v:=public.service_apply_pipeline_dispatch('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',repeat('b',64),'boards.discover','{"url":"https://jobs.lever.co/private-b","type":"lever"}');
  perform public.test_apply_pipeline_assert(v->'board'->>'status'='pending','discovery is private probation');
end $$;
reset role;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $$ declare v jsonb; begin
  perform public.test_apply_pipeline_assert(public.my_apply_pipeline_action('boards.list','{}')->'boards'='[]'::jsonb,'A cannot see B private board');
  v:=public.my_apply_pipeline_action('agent.list','{}');
  perform public.test_apply_pipeline_assert(exists(select 1 from jsonb_array_elements(v->'agents') a where a->>'engine_version'='proof' and a ? 'heartbeat_at' and not a ? 'state'),'agent response is flat');
  v:=public.my_apply_pipeline_action('commands.request','{"bindingId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","type":"check_session","args":{"portal":"greenhouse"}}');
  perform public.test_apply_pipeline_assert(v->'command'->>'type'='check_session','check_session is fixed explicit command');
end $$;
reset role;
commit;

-- Command targets originate in own SQL task snapshots and are revalidated at
-- claim; a restarted worker can recover login without an in-memory portal map.
begin;
do $$ declare t public.apply_tasks%rowtype; other public.apply_tasks%rowtype; q jsonb; c jsonb; claimed jsonb; args jsonb; old_nonce uuid; begin
  delete from public.apply_binding_commands;
  select * into t from public.apply_tasks where job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/2';
  select * into other from public.apply_tasks where job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/1';
  perform set_config('request.jwt.claim.role','service_role',true);
  update public.apply_tasks set status='in_progress',claimed_by=target_binding_id,lease_version=lease_version+1,lease_nonce=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes' where id=t.id;
  select * into t from public.apply_tasks where id=t.id;
  q:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'questions.queue',jsonb_build_object('taskId',t.id,'leaseVersion',t.lease_version,'leaseNonce',t.lease_nonce,
    'question','{"meaning":"unknown:command review","questionText":"Review this exact application field?","controlType":"text","options":[],"context":{"application":"https://boards.greenhouse.io/proof/jobs/2"},"scope":"application"}'::jsonb));
  c:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'tasks.report',jsonb_build_object('taskId',t.id,'leaseVersion',t.lease_version,'leaseNonce',t.lease_nonce,'status','waiting_login'));
  perform set_config('request.jwt.claim.role','authenticated',true); perform set_config('request.jwt.claim.sub',t.user_id::text,true);
  for args in select value from jsonb_array_elements('[{"type":"retry_login"},{"type":"check_session","args":{}},{"type":"open_question"},{"type":"pause","args":{"portal":"greenhouse"}},{"type":"check_session","args":{"portal":"greenhouse","jobUrl":"https://evil.example/job"}}]'::jsonb) loop
    perform public.test_apply_pipeline_denied(format('select public.my_apply_pipeline_action(''commands.request'',%L)',(args||jsonb_build_object('bindingId',t.target_binding_id))::text));
  end loop;
  perform public.test_apply_pipeline_denied(format('select public.my_apply_pipeline_action(''commands.request'',%L)',jsonb_build_object('bindingId','cccccccc-cccc-4ccc-8ccc-cccccccccccc','type','open_question','args',jsonb_build_object('questionId',q->'question'->>'id'))::text));
  perform public.test_apply_pipeline_denied(format('select public.my_apply_pipeline_action(''commands.request'',%L)',jsonb_build_object('bindingId','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','type','check_session','args',jsonb_build_object('portal','greenhouse'))::text));
  c:=public.my_apply_pipeline_action('commands.request',jsonb_build_object('bindingId',t.target_binding_id,'type','open_question','args',jsonb_build_object('questionId',q->'question'->>'id')));
  perform set_config('request.jwt.claim.role','service_role',true);
  claimed:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'commands.claim','{}')->'commands'->0;
  perform public.test_apply_pipeline_assert(claimed->'job'=t.job and claimed->>'task_id'=t.id::text and claimed->'question'->>'id'=q->'question'->>'id' and claimed->'question'->>'status'='pending','manual question command supplies only own task snapshot and exact pending question');
  old_nonce:=(claimed->>'claim_nonce')::uuid;
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''c'',64),''commands.report'',%L)','cccccccc-cccc-4ccc-8ccc-cccccccccccc',jsonb_build_object('commandId',claimed->>'id','claimNonce',old_nonce,'status','done')::text));
  update public.apply_binding_commands set claimed_at=clock_timestamp()-interval '6 minutes' where id=(claimed->>'id')::uuid;
  claimed:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'commands.claim','{}')->'commands'->0;
  perform public.test_apply_pipeline_assert((claimed->>'claim_nonce')::uuid<>old_nonce,'crashed command reclaim generates a fresh report fence');
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''commands.report'',%L)',t.target_binding_id,jsonb_build_object('commandId',claimed->>'id','claimNonce',old_nonce,'status','done')::text));
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''commands.report'',%L)',t.target_binding_id,jsonb_build_object('commandId',claimed->>'id','claimNonce',claimed->>'claim_nonce','status','submitted')::text));
  update public.apply_tasks set status='waiting_review',reason='Human window owns this portal; retry after it closes' where id=other.id;
  c:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'commands.report',jsonb_build_object('commandId',claimed->>'id','claimNonce',claimed->>'claim_nonce','status','done'));
  perform public.test_apply_pipeline_assert((select status='queued' from public.apply_tasks where id=other.id),'completed manual window retries only another transient window-blocked task');
  perform public.test_apply_pipeline_assert((select status='waiting_login' from public.apply_tasks where id=t.id),'completed question window never requeues its original manual target');
  perform set_config('request.jwt.claim.role','authenticated',true);
  c:=public.my_apply_pipeline_action('commands.request',jsonb_build_object('bindingId',t.target_binding_id,'type','retry_login','args',jsonb_build_object('portal','greenhouse:boards.greenhouse.io/proof')));
  perform set_config('request.jwt.claim.role','service_role',true);
  claimed:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'commands.claim','{}')->'commands'->0;
  perform public.test_apply_pipeline_assert(claimed->'job'=t.job and claimed->>'task_id'=t.id::text,'restart login command has waiting-login job without in-memory state');
  c:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'sessions.report','{"portal":"greenhouse:boards.greenhouse.io/proof","status":"authenticated"}');
  perform public.test_apply_pipeline_assert((select status='waiting_answer' from public.apply_tasks where id=t.id),'positive canonical session resumes login into still-pending answer wait');
  perform set_config('request.jwt.claim.role','authenticated',true);
  c:=public.my_apply_pipeline_action('commands.request',jsonb_build_object('bindingId',t.target_binding_id,'type','open_question','args',jsonb_build_object('questionId',q->'question'->>'id')));
  update public.apply_question_inbox set status='dismissed' where id=(q->'question'->>'id')::uuid;
  perform set_config('request.jwt.claim.role','service_role',true);
  claimed:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'commands.claim','{}');
  perform public.test_apply_pipeline_assert(claimed->'commands'='[]'::jsonb and (select status='failed' from public.apply_binding_commands where id=(c->'command'->>'id')::uuid),'answered or dismissed question cannot be claimed as pending');
  update public.apply_question_inbox set status='pending' where id=(q->'question'->>'id')::uuid;
  perform set_config('request.jwt.claim.role','authenticated',true);
  c:=public.my_apply_pipeline_action('commands.request',jsonb_build_object('bindingId',t.target_binding_id,'type','open_question','args',jsonb_build_object('questionId',q->'question'->>'id')));
  update public.apply_tasks set status='submitted' where id=t.id;
  perform set_config('request.jwt.claim.role','service_role',true);
  claimed:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'commands.claim','{}');
  perform public.test_apply_pipeline_assert(claimed->'commands'='[]'::jsonb,'submitted tasks never receive question navigation command');
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform public.test_apply_pipeline_denied(format('select public.my_apply_pipeline_action(''commands.request'',%L)',jsonb_build_object('bindingId',t.target_binding_id,'type','open_question','args',jsonb_build_object('questionId',q->'question'->>'id'))::text));
  update public.apply_tasks set status='waiting_login' where id=t.id;
  c:=public.my_apply_pipeline_action('commands.request',jsonb_build_object('bindingId',t.target_binding_id,'type','pause'));
  c:=public.my_apply_pipeline_action('commands.request',jsonb_build_object('bindingId',t.target_binding_id,'type','resume'));
  perform public.test_apply_pipeline_assert((select status='waiting_login' from public.apply_tasks where id=t.id),'pause/resume preserves login wait');
  perform public.test_apply_pipeline_assert((select status='queued' from public.apply_tasks where id=other.id),'resume recovers current pause-only queued task');
  perform set_config('request.jwt.claim.role','service_role',true);
  claimed:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'commands.claim','{}');
  perform public.test_apply_pipeline_assert(not exists(select 1 from jsonb_array_elements(claimed->'commands') x where x->>'type'='pause') and exists(select 1 from jsonb_array_elements(claimed->'commands') x where x->>'type'='resume'),'superseded pause cannot undo newer resume after crash');
end $$;
rollback;

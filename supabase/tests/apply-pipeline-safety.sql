-- Revision invalidation, resume opt-in, quiet-zone/caps, pause, stale leases,
-- automatic bounded rediscovery and post-expiry cleanup. Rolls back all probes.
begin;
do $$ declare t public.apply_tasks%rowtype; p jsonb; s jsonb; r jsonb; a jsonb; lease jsonb; rid uuid; before_runs integer; begin
  perform set_config('request.jwt.claim.role','service_role',true);
  -- A matched job with the oldest created_at is claimed deterministically.
  update public.apply_tasks set created_at=case when job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/1' then now()-interval '1 day' else now() end;
  a:=public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'tasks.claim','{"limit":1,"leaseSeconds":30}');
  select * into t from public.apply_tasks where id=(a->'tasks'->0->>'id')::uuid;
  lease:=jsonb_build_object('taskId',t.id,'leaseVersion',t.lease_version,'leaseNonce',t.lease_nonce);
  update public.apply_tasks set lease_until=now()-interval '1 second' where id=t.id;
  a:=public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'tasks.claim','{"limit":1}');
  perform public.test_apply_pipeline_assert(a->'tasks'->0->>'id'=t.id::text and (a->'tasks'->0->>'lease_version')::integer>t.lease_version,'expired pre-submit lease can be fenced and reclaimed');
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''tasks.renew'',%L)','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',lease::text));
  select * into t from public.apply_tasks where id=t.id;
  lease:=jsonb_build_object('taskId',t.id,'leaseVersion',t.lease_version,'leaseNonce',t.lease_nonce);
  -- Quiet hours spanning midnight use the owner's timezone and fail closed.
  update public.apply_pipeline_settings set data=data||'{"quietFrom":"00:00","quietTo":"00:00","timeZone":"Asia/Kolkata"}' where user_id=t.user_id;
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.reserve'',%L)','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(lease||'{"profileRevision":1,"settingsRevision":2,"answersRevision":1,"siteAllowed":true,"accountVerified":true,"requiredComplete":true,"answerIds":[],"idempotencyKey":"quiet-proof"}')::text));
  update public.apply_pipeline_settings set data=data-'quietFrom'-'quietTo'||'{"dailyCap":0}' where user_id=t.user_id;
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.reserve'',%L)','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(lease||'{"profileRevision":1,"settingsRevision":2,"answersRevision":1,"siteAllowed":true,"accountVerified":true,"requiredComplete":true,"answerIds":[],"idempotencyKey":"cap-proof"}')::text));
  update public.apply_pipeline_settings set data=data||'{"dailyCap":10,"timeZone":"UTC"}' where user_id=t.user_id;
  r:=public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'submission.reserve',lease||'{"profileRevision":1,"settingsRevision":2,"answersRevision":1,"siteAllowed":true,"accountVerified":true,"requiredComplete":true,"answerIds":[],"idempotencyKey":"durable-proof"}');
  update public.apply_tasks set lease_until=now()-interval '1 second' where id=t.id;
  a:=public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'tasks.claim','{"limit":10}');
  perform public.test_apply_pipeline_assert(not exists(select 1 from jsonb_array_elements(a->'tasks') x where x->>'id'=t.id::text),'expired submit lease is never replayed');
  perform public.test_apply_pipeline_assert((select status='unverified' from public.apply_submission_reservations where task_id=t.id),'uncertainty persists before next claim');
  -- Pause is owner-latched: worker heartbeats cannot silently undo it.
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',t.user_id::text,true);
  a:=public.my_apply_pipeline_action('commands.request','{"bindingId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","type":"pause"}');
  perform set_config('request.jwt.claim.role','service_role',true);
  a:=public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'agent.heartbeat','{"engineVersion":"proof","capabilities":[],"status":"ready"}');
  perform public.test_apply_pipeline_assert((select status='paused' and control_paused from public.apply_binding_state where binding_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'pause cannot be overwritten by ready heartbeat');
  perform public.test_apply_pipeline_assert(public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'tasks.claim','{}')->'tasks'='[]'::jsonb,'pause stops queue claims');
  perform set_config('request.jwt.claim.role','authenticated',true);
  a:=public.my_apply_pipeline_action('commands.request','{"bindingId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","type":"resume"}');
  -- Confirming new facts invalidates plans; never mutates reserved snapshots.
  p:=public.my_apply_pipeline_action('profile.get','{}');
  p:=public.my_apply_pipeline_action('profile.confirm',jsonb_build_object('expectedRevision',1,'facts',p->'profile'->'facts','resumeText','Reconfirmed exact resume','resumeApproved',true));
  perform public.test_apply_pipeline_assert(p->'profile'->>'revision'='2','profile revision advances');
  perform public.test_apply_pipeline_assert(not exists(select 1 from public.apply_tasks where user_id=t.user_id and status='queued'),'old queued plans invalidated');
  perform public.test_apply_pipeline_assert((select profile_revision=1 from public.apply_tasks where id=t.id),'reserved attempt snapshot immutable across profile changes');
  -- Expiry blocks private worker operations but allows the exact reserved finish.
  update public.entitlements set addons='{}',tier='free' where user_id=t.user_id;
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.test_apply_pipeline_denied($q$select public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'profile.get','{}')$q$);
  a:=public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'submission.finish',lease||jsonb_build_object('reservationId',r->'reservation'->>'id','reservationNonce',r->'reservation'->>'nonce','outcome','unverified'));
  perform public.test_apply_pipeline_assert(a->'reservation'->>'status'='unverified','safe prior-attempt finish after expiry only');
  perform set_config('request.jwt.claim.role','authenticated',true);
  a:=public.my_apply_pipeline_action('run.cancel',jsonb_build_object('runId',t.run_id));
  perform public.test_apply_pipeline_assert(a->'run'->>'status'='cancelled','owner can cancel after access expiry');
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('run.request','{"bindingId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}')$q$);
  s:=public.my_apply_pipeline_action('settings.get','{}');
  a:=public.my_apply_pipeline_action('settings.put',jsonb_build_object('expectedRevision',2,'settings',(s->'settings'->'data')||'{"enabled":false,"autoSubmit":false}'));
  perform public.test_apply_pipeline_assert(a->'settings'->'data'->>'enabled'='false','owner can disable safely after expiry');
  -- Revocation always wins, even for safe prior-attempt finish.
  update public.apply_agent_bindings set revoked_at=now() where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.finish'',%L)','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(lease||jsonb_build_object('reservationId',r->'reservation'->>'id','reservationNonce',r->'reservation'->>'nonce','outcome','unverified'))::text));
end $$;
rollback;

begin;
do $$ declare r jsonb; before_runs integer; begin
  -- Continuous scans require a prior explicit owner run on that exact machine.
  update public.apply_tasks set status='filtered' where user_id='22222222-2222-4222-8222-222222222222';
  update public.apply_runs set created_at=now()-interval '20 minutes';
  select count(*) into before_runs from public.apply_runs;
  perform set_config('request.jwt.claim.role','service_role',true);
  r:=public.service_apply_pipeline_dispatch('cccccccc-cccc-4ccc-8ccc-cccccccccccc',repeat('c',64),'tasks.claim','{}');
  perform public.test_apply_pipeline_assert((select count(*)=before_runs from public.apply_runs),'unselected machine cannot create autonomous runs');
  r:=public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'tasks.claim','{}');
  perform public.test_apply_pipeline_assert((select count(*)=before_runs+1 from public.apply_runs),'selected idle worker creates future bounded run');
  r:=public.service_apply_pipeline_dispatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'tasks.claim','{}');
  perform public.test_apply_pipeline_assert((select count(*)=before_runs+1 from public.apply_runs),'fifteen-minute schedule does not busy-spin new runs');
end $$;
rollback;

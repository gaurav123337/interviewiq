-- Reviewer regressions: job-bound receipt, portal source-of-truth approvals,
-- and honest uncertainty without a functioning entitled/revoked worker.
begin;
do $$ declare t public.apply_tasks%rowtype; lease jsonb; args jsonb; p jsonb; r jsonb; v_portal text; fact jsonb; until_time text; begin
  perform set_config('request.jwt.claim.role','service_role',true);
  select * into t from public.apply_tasks where job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/1';
  update public.apply_tasks set status='in_progress',claimed_by=target_binding_id,lease_version=1,lease_nonce=gen_random_uuid(),lease_until=now()+interval '5 minutes' where id=t.id returning * into t;
  lease:=jsonb_build_object('taskId',t.id,'leaseVersion',t.lease_version,'leaseNonce',t.lease_nonce);
  args:=lease||jsonb_build_object('profileRevision',t.profile_revision,'settingsRevision',t.settings_revision,'answersRevision',t.answers_revision,'siteAllowed',true,'accountVerified',true,'requiredComplete',true,'answerIds','[]'::jsonb,'idempotencyKey','receipt-reviewer');
  r:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'submission.reserve',args);
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.finish'',%L)',t.target_binding_id,
    (lease||jsonb_build_object('reservationId',r->'reservation'->>'id','reservationNonce',r->'reservation'->>'nonce','outcome','submitted','evidence',jsonb_build_object('kind','confirmation_page','text','Application submitted','url','https://boards.greenhouse.io/another-employer/jobs/1')))::text));
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.finish'',%L)',t.target_binding_id,
    (lease||jsonb_build_object('reservationId',r->'reservation'->>'id','reservationNonce',r->'reservation'->>'nonce','outcome','submitted','evidence',jsonb_build_object('kind','confirmation_page','text','Application submitted')))::text));
  perform public.test_apply_pipeline_assert(public.apply_pipeline_receipt_url(t.job->>'jobUrl','https://boards.greenhouse.io/proof/jobs/1/thanks'),'exact qualified receipt route accepted');
  -- No entitled agent remains, but the owner can still inspect honest state.
  update public.apply_tasks set lease_until=now()-interval '1 second' where id=t.id;
  update public.apply_agent_bindings set revoked_at=now() where user_id=t.user_id;
  update public.entitlements set tier='free',addons='{}' where user_id=t.user_id;
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',t.user_id::text,true);
  p:=public.my_apply_pipeline_action('tasks.list','{}');
  perform public.test_apply_pipeline_assert(exists(select 1 from jsonb_array_elements(p->'tasks') x where x->>'id'=t.id::text and x->>'status'='unverified'),'owner list expires abandoned irreversible attempt after expiry/revoke');
  perform public.test_apply_pipeline_assert((select status='unverified' from public.apply_submission_reservations where task_id=t.id),'owner cleanup preserves durable uncertainty, not replay');
end $$;
rollback;

begin;
do $$ declare t public.apply_tasks%rowtype; lease jsonb; args jsonb; r jsonb; v_adapter text; v_portal text; k text; f jsonb; saved_facts jsonb; begin
  perform set_config('request.jwt.claim.role','service_role',true);
  select * into t from public.apply_tasks where job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/1';
  select facts into saved_facts from public.apply_verified_profiles where user_id=t.user_id;
  foreach v_adapter in array array['naukri','instahyre'] loop
    update public.apply_tasks set job=jsonb_build_object('jobUrl',case when v_adapter='naukri' then 'https://www.naukri.com/job-listings-proof-engineer-123456789' else 'https://www.instahyre.com/job-123-proof-engineer' end,
      'title','Software Engineer','company','Proof Employer','description','Build software','skills','["typescript"]'::jsonb,'location','Remote'),status='in_progress',claimed_by=target_binding_id,lease_version=1,lease_nonce=gen_random_uuid(),lease_until=now()+interval '5 minutes'
      where id=t.id returning * into t;
    v_portal:=public.apply_pipeline_job_context(t.job)->>'portal';
    perform public.test_apply_pipeline_assert(public.apply_pipeline_job_context(t.job||'{"portal":"spoofed"}')->>'portal'=v_portal,'known vendor portal identity is derived, never caller override');
    lease:=jsonb_build_object('taskId',t.id,'leaseVersion',t.lease_version,'leaseNonce',t.lease_nonce);
    args:=lease||jsonb_build_object('profileRevision',t.profile_revision,'settingsRevision',t.settings_revision,'answersRevision',t.answers_revision,'siteAllowed',true,'accountVerified',true,'requiredComplete',true,'answerIds','[]'::jsonb,'idempotencyKey','portal-reviewer:'||v_adapter);
    update public.apply_verified_profiles set facts=saved_facts where user_id=t.user_id;
    insert into public.apply_binding_sessions(binding_id,user_id,portal,status,account_label,checked_at) values(t.target_binding_id,t.user_id,v_portal,'authenticated','verified@example.com',now())
      on conflict(binding_id,portal) do update set status=excluded.status,account_label=excluded.account_label,checked_at=excluded.checked_at;
    perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.reserve'',%L)',t.target_binding_id,args::text));
    f:=jsonb_build_object('source','user','confirmedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'validUntil',to_char((now()+interval '1 day') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'scope',jsonb_build_object('portal',v_portal));
    update public.apply_verified_profiles set facts=facts||jsonb_build_object('portalProfileApproved:'||v_adapter,f||'{"value":true}',
      'portalAccountIdentity:'||v_adapter,f||'{"value":"verified@example.com"}','portalResumeText:'||v_adapter,f||jsonb_build_object('value',resume_text)) where user_id=t.user_id;
    update public.apply_binding_sessions set account_label='other@example.com' where binding_id=t.target_binding_id and portal=v_portal;
    perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.reserve'',%L)',t.target_binding_id,args::text));
    update public.apply_binding_sessions set account_label='verified@example.com' where binding_id=t.target_binding_id and portal=v_portal;
    update public.apply_verified_profiles set facts=jsonb_set(facts,array['portalResumeText:'||v_adapter,'value'],'"wrong resume"') where user_id=t.user_id;
    perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.reserve'',%L)',t.target_binding_id,args::text));
    update public.apply_verified_profiles set facts=jsonb_set(facts,array['portalResumeText:'||v_adapter,'value'],to_jsonb(resume_text)) where user_id=t.user_id;
    update public.apply_verified_profiles set facts=jsonb_set(facts,array['portalProfileApproved:'||v_adapter,'scope'],jsonb_build_object('portal','wrong-portal')) where user_id=t.user_id;
    perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.reserve'',%L)',t.target_binding_id,args::text));
    update public.apply_verified_profiles set facts=jsonb_set(facts,array['portalProfileApproved:'||v_adapter,'scope'],jsonb_build_object('portal',v_portal)) where user_id=t.user_id;
    update public.apply_verified_profiles set facts=jsonb_set(facts,array['portalProfileApproved:'||v_adapter,'validUntil'],to_jsonb((now()-interval '1 second')::text)) where user_id=t.user_id;
    perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.reserve'',%L)',t.target_binding_id,args::text));
    update public.apply_verified_profiles set facts=jsonb_set(facts,array['portalProfileApproved:'||v_adapter,'validUntil'],to_jsonb((now()+interval '31 days')::text)) where user_id=t.user_id;
    perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.reserve'',%L)',t.target_binding_id,args::text));
    update public.apply_verified_profiles set facts=jsonb_set(facts,array['portalProfileApproved:'||v_adapter,'validUntil'],f->'validUntil') where user_id=t.user_id;
    r:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'submission.reserve',args);
    perform public.test_apply_pipeline_assert(r->'reservation'->>'status'='reserved','current scoped user portal facts + observed account match permit reserve');
    delete from public.apply_submission_reservations where task_id=t.id;
  end loop;
end $$;
rollback;

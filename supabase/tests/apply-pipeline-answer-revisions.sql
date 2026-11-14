-- One new global answer must refresh every unsubmitted current plan without
-- stranding unrelated workers or replaying an irreversible reservation.
begin;
do $$ declare linked public.apply_tasks%rowtype; unrelated public.apply_tasks%rowtype; reserved public.apply_tasks%rowtype;
  q jsonb; a jsonb; r jsonb; old_lease jsonb; args jsonb; policy_id uuid; pending_id uuid; login_id uuid; begin
  perform set_config('request.jwt.claim.role','service_role',true);
  select * into linked from public.apply_tasks where job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/1';
  select * into unrelated from public.apply_tasks where job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/2';
  select * into reserved from public.apply_tasks where job->>'jobUrl'='https://jobs.ashbyhq.com/proof/123e4567-e89b-42d3-a456-426614174000';
  update public.apply_tasks set status='in_progress',claimed_by=target_binding_id,lease_version=1,lease_nonce=gen_random_uuid(),lease_until=now()+interval '5 minutes'
    where id in (linked.id,unrelated.id,reserved.id);
  select * into linked from public.apply_tasks where id=linked.id;
  select * into unrelated from public.apply_tasks where id=unrelated.id;
  select * into reserved from public.apply_tasks where id=reserved.id;
  old_lease:=jsonb_build_object('taskId',unrelated.id,'leaseVersion',unrelated.lease_version,'leaseNonce',unrelated.lease_nonce);
  args:=jsonb_build_object('taskId',reserved.id,'leaseVersion',reserved.lease_version,'leaseNonce',reserved.lease_nonce,
    'profileRevision',reserved.profile_revision,'settingsRevision',reserved.settings_revision,'answersRevision',reserved.answers_revision,
    'siteAllowed',true,'accountVerified',true,'requiredComplete',true,'answerIds','[]'::jsonb,'idempotencyKey','answer-revision-reserved');
  r:=public.service_apply_pipeline_dispatch(reserved.target_binding_id,repeat('a',64),'submission.reserve',args);
  q:=public.service_apply_pipeline_dispatch(linked.target_binding_id,repeat('a',64),'questions.queue',jsonb_build_object(
    'taskId',linked.id,'leaseVersion',linked.lease_version,'leaseNonce',linked.lease_nonce,
    'question',jsonb_build_object('meaning','noticePeriod','questionText','What is your notice period?','controlType','text','options','[]'::jsonb,'context','{}'::jsonb,'scope','global')));
  a:=public.service_apply_pipeline_dispatch(linked.target_binding_id,repeat('a',64),'tasks.report',jsonb_build_object(
    'taskId',linked.id,'leaseVersion',linked.lease_version,'leaseNonce',linked.lease_nonce,'status','waiting_answer','reason','Confirmed answer required'));
  -- Policy review must remain review; login remains login with current bank.
  insert into public.apply_tasks(user_id,run_id,target_binding_id,job_key,job,status,score,reason,profile_revision,settings_revision,answers_revision)
    values(linked.user_id,linked.run_id,linked.target_binding_id,'test-policy',linked.job||'{"jobUrl":"https://www.linkedin.com/jobs/view/123"}','waiting_review',100,'LinkedIn policy requires manual review',1,2,1) returning id into policy_id;
  insert into public.apply_tasks(user_id,run_id,target_binding_id,job_key,job,status,score,reason,profile_revision,settings_revision,answers_revision)
    values(linked.user_id,linked.run_id,linked.target_binding_id,'test-login',linked.job,'waiting_login',100,'Verified login required',1,2,1) returning id into login_id;
  insert into public.apply_tasks(user_id,run_id,target_binding_id,job_key,job,status,score,reason,profile_revision,settings_revision,answers_revision)
    values(linked.user_id,linked.run_id,linked.target_binding_id,'test-revision',linked.job,'waiting_review',100,'revision_changed',1,2,1) returning id into pending_id;
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',linked.user_id::text,true);
  a:=public.my_apply_pipeline_action('questions.answer',jsonb_build_object('questionId',q->'question'->>'id','answer','30 days','scope','global','confirm',true));
  perform public.test_apply_pipeline_assert((select status='queued' and answers_revision=2 from public.apply_tasks where id=linked.id),'question-linked task resumes');
  perform public.test_apply_pipeline_assert((select status='queued' and answers_revision=2 and lease_version>unrelated.lease_version and lease_nonce is null and claimed_by is null from public.apply_tasks where id=unrelated.id),'unrelated active worker gets new bank revision and loses old fence');
  perform public.test_apply_pipeline_assert((select status='submitting' and answers_revision=1 and lease_version=reserved.lease_version and lease_nonce=reserved.lease_nonce from public.apply_tasks where id=reserved.id),'reserved attempt keeps immutable prior bank snapshot and fence');
  perform public.test_apply_pipeline_assert((select status='waiting_review' and reason='LinkedIn policy requires manual review' from public.apply_tasks where id=policy_id),'manual portal policy never auto-resumed');
  perform public.test_apply_pipeline_assert((select status='waiting_login' and answers_revision=2 from public.apply_tasks where id=login_id),'login wait preserved with current bank');
  perform public.test_apply_pipeline_assert((select status='queued' and answers_revision=2 from public.apply_tasks where id=pending_id),'bank-only revision review is recovered');
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''tasks.report'',%L)',unrelated.target_binding_id,(old_lease||'{"status":"failed"}')::text));
  a:=public.service_apply_pipeline_dispatch(linked.target_binding_id,repeat('a',64),'tasks.claim','{"limit":10}');
  perform public.test_apply_pipeline_assert(exists(select 1 from jsonb_array_elements(a->'tasks') x where x->>'id'=unrelated.id::text and x->>'answers_revision'='2' and (x->>'lease_version')::integer>unrelated.lease_version),'new claim rechecks complete current bank');
  perform public.test_apply_pipeline_assert(not exists(select 1 from jsonb_array_elements(a->'tasks') x where x->>'id'=reserved.id::text),'reserved attempt cannot be replayed after unrelated answer');
end $$;
rollback;

-- Literal known aliases/options batch once; live question context is usable only
-- on proven current task associations, never by arbitrary bank/context widening.
begin;
do $$ declare t public.apply_tasks%rowtype; other public.apply_tasks%rowtype; q jsonb; q2 jsonb; a jsonb; args jsonb;
  email_id uuid; salary_id uuid; country_id uuid; lease jsonb; begin
  perform set_config('request.jwt.claim.role','service_role',true);
  select * into t from public.apply_tasks where job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/2';
  select * into other from public.apply_tasks where job->>'jobUrl'='https://jobs.ashbyhq.com/proof/123e4567-e89b-42d3-a456-426614174000';
  update public.apply_tasks set status='in_progress',claimed_by=target_binding_id,lease_version=lease_version+1,
    lease_nonce=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes' where id in (t.id,other.id);
  select * into t from public.apply_tasks where id=t.id; select * into other from public.apply_tasks where id=other.id;
  lease:=jsonb_build_object('taskId',t.id,'leaseVersion',t.lease_version,'leaseNonce',t.lease_nonce);
  q:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'questions.queue',lease||'{"question":{"meaning":"email","questionText":"E-mail address?","controlType":"text","options":[],"context":{},"scope":"global"}}');
  q2:=public.service_apply_pipeline_dispatch(other.target_binding_id,repeat('a',64),'questions.queue',jsonb_build_object('taskId',other.id,'leaseVersion',other.lease_version,'leaseNonce',other.lease_nonce,
    'question','{"meaning":"email","questionText":"Email address *","controlType":"text","options":[],"context":{},"scope":"global"}'::jsonb));
  perform public.test_apply_pipeline_assert(q->'question'->>'id'=q2->'question'->>'id','known literal email aliases batch before confirmation');
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''questions.queue'',%L)',t.target_binding_id,
    (lease||'{"question":{"meaning":"email","questionText":"Unrelated legal claim?","controlType":"text","options":[],"context":{},"scope":"global"}}')::text));
  perform public.test_apply_pipeline_assert(public.apply_pipeline_question_label('How many years of Node.js experience?')->>'meaning'='skillYears:node','dedicated skill-year literal aliases retain server-verified reusable meaning');
  q2:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'questions.queue',lease||'{"question":{"meaning":"expectedSalary","questionText":"Expected salary (INR)","controlType":"number","options":[],"context":{"country":"US","currency":"INR"},"scope":"country","scopeKey":"US"}}');
  salary_id:=(q2->'question'->>'id')::uuid;
  q2:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'questions.queue',lease||'{"question":{"meaning":"workAuthorization","questionText":"Are you legally authorized to work in India?","controlType":"radio","options":["Yes","No"],"context":{"country":"IN"},"scope":"country","scopeKey":"IN"}}');
  country_id:=(q2->'question'->>'id')::uuid;
  a:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'questions.queue',lease||'{"question":{"meaning":"workAuthorization","questionText":"Work authorization in India","controlType":"radio","options":["No","Yes"],"context":{"country":"IN"},"scope":"country","scopeKey":"IN"}}');
  perform public.test_apply_pipeline_assert(a->'question'->>'id'=country_id::text,'known aliases and reordered exact option sets batch together');
  a:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'questions.queue',lease||'{"question":{"meaning":"workAuthorization","questionText":"Work authorization in India","controlType":"radio","options":["Yes","No","Other"],"context":{"country":"IN"},"scope":"country","scopeKey":"IN"}}');
  perform public.test_apply_pipeline_assert(a->'question'->>'id'<>country_id::text,'different option sets never merge');
  delete from public.apply_question_inbox where id=(a->'question'->>'id')::uuid;
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''questions.queue'',%L)',t.target_binding_id,
    (lease||'{"question":{"meaning":"expectedSalary","questionText":"Expected salary (INR)","controlType":"number","options":[],"context":{"country":"US","currency":"USD"},"scope":"country","scopeKey":"US"}}')::text));
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''questions.queue'',%L)',t.target_binding_id,
    (lease||'{"question":{"meaning":"workAuthorization","questionText":"Work authorization","controlType":"radio","options":["Yes","No"],"context":{"country":"IN"},"scope":"country","scopeKey":"IN"}}')::text));
  perform set_config('request.jwt.claim.role','authenticated',true); perform set_config('request.jwt.claim.sub',t.user_id::text,true);
  a:=public.my_apply_pipeline_action('questions.answer',jsonb_build_object('questionId',q->'question'->>'id','answer','synthetic@example.test','scope','global','confirm',true));
  email_id:=(a->'answer'->>'id')::uuid;
  perform public.test_apply_pipeline_assert(not exists(select 1 from public.apply_question_tasks qt join public.apply_question_inbox i on i.id=qt.question_id where qt.task_id in (t.id,other.id) and i.meaning='email' and i.status='pending'),'one alias confirmation resolves both task email questions');
  a:=public.my_apply_pipeline_action('questions.answer',jsonb_build_object('questionId',salary_id,'answer','2500000','scope','country','scopeKey','US','confirm',true));
  salary_id:=(a->'answer'->>'id')::uuid;
  a:=public.my_apply_pipeline_action('questions.answer',jsonb_build_object('questionId',country_id,'answer','Yes','scope','country','scopeKey','IN','confirm',true));
  country_id:=(a->'answer'->>'id')::uuid;
  perform set_config('request.jwt.claim.role','service_role',true);
  a:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'tasks.claim','{"limit":10}');
  select * into t from public.apply_tasks where id=t.id; select * into other from public.apply_tasks where id=other.id;
  args:=jsonb_build_object('taskId',other.id,'leaseVersion',other.lease_version,'leaseNonce',other.lease_nonce,'profileRevision',1,'settingsRevision',2,
    'answersRevision',other.answers_revision,'siteAllowed',true,'accountVerified',true,'requiredComplete',true,'answerIds',jsonb_build_array(salary_id,country_id),'idempotencyKey','wrong-task-live-context');
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.reserve'',%L)',other.target_binding_id,args::text));
  lease:=jsonb_build_object('taskId',t.id,'leaseVersion',t.lease_version,'leaseNonce',t.lease_nonce);
  q:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'questions.queue',lease||'{"question":{"meaning":"expectedSalary","questionText":"Salary expectations (INR)","controlType":"number","options":[],"context":{"country":"US","currency":"INR"},"scope":"country","scopeKey":"US"}}');
  perform public.test_apply_pipeline_assert(q->'question'->>'status'='answered' and q->'question'->>'answer_id'=salary_id::text,'known current bank answer stays answered when associating live form');
  args:=args||lease||jsonb_build_object('answersRevision',t.answers_revision,'idempotencyKey','live-context-approved');
  update public.apply_question_tasks set job_context='{}' where task_id=t.id and question_id=(q->'question'->>'id')::uuid;
  perform public.test_apply_pipeline_denied(format('select public.service_apply_pipeline_dispatch(%L,repeat(''a'',64),''submission.reserve'',%L)',t.target_binding_id,args::text));
  q:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'questions.queue',lease||'{"question":{"meaning":"expectedSalary","questionText":"Expected salary (INR)","controlType":"number","options":[],"context":{"country":"US","currency":"INR"},"scope":"country","scopeKey":"US"}}');
  a:=public.service_apply_pipeline_dispatch(t.target_binding_id,repeat('a',64),'submission.reserve',args);
  perform public.test_apply_pipeline_assert(a->'reservation'->>'status'='reserved','confirmed live INR and explicit India question reserve on exact linked task despite missing job salary/different job country');
end $$;
rollback;

-- Current-contract proof after ALL historical suites and their concurrent cap
-- race. Synthetic fixtures only, rolled back in the runner's disposable DB.
-- Helpers are invokers: calls switch to the real API role, never bypass wrappers.
begin;

create function public.test_verified_id(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function public.test_verified_ack(v jsonb, field text) returns jsonb language plpgsql as $$ begin
  perform public.test_apply_pipeline_assert(v->'ok'='true'::jsonb and jsonb_typeof(v->field)='object'
    and (select count(*)=2 from jsonb_object_keys(v)) and v->field ? 'id'
    and not v->field ? 'user_id','successful learning mutation returns exactly ok:true plus camel-case row');
  return v;
end $$;
create function public.test_verified_user(action text,args jsonb default '{}',owner uuid default '55555555-5555-4555-8555-555555555555')
returns jsonb language plpgsql as $$ declare v jsonb; field text; begin
  perform set_config('request.jwt.claim.sub',owner::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  set local role authenticated;
  v:=public.my_apply_pipeline_action(action,args);
  reset role;
  field:=case action when 'learning.feedback' then 'feedback' when 'learning.grant' then 'grant'
    when 'learning.manual_report' then 'receipt' when 'learning.question' then 'question'
    when 'learning.revoke' then case when args ? 'feedbackId' then 'feedback' else 'grant' end end;
  if field is not null then v:=public.test_verified_ack(v,field); end if;
  return v;
exception when others then reset role; raise;
end $$;
create function public.test_verified_worker(action text,args jsonb default '{}',other boolean default false)
returns jsonb language plpgsql as $$ declare v jsonb; begin
  perform set_config('request.jwt.claim.role','service_role',true);
  set local role service_role;
  v:=public.service_apply_pipeline_dispatch(
    case when other then 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid else 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid end,
    repeat(case when other then 'e' else 'd' end,64),action,args);
  reset role;
  if action='learning.manual_observe' then v:=public.test_verified_ack(v,'receipt'); end if;
  return v;
exception when others then reset role; raise;
end $$;
-- Assert the particular failing gate, not just any incidental rejection.
create function public.test_verified_denied(sql text,state text,message text) returns void language plpgsql as $$
declare actual_state text; actual_message text; begin
  begin execute sql; exception when others then
    get stacked diagnostics actual_state=returned_sqlstate,actual_message=message_text;
  end;
  perform public.test_apply_pipeline_assert(actual_state=state and actual_message=message,
    format('expected %s / %s, got %s / %s',state,message,actual_state,actual_message));
end $$;
create function public.test_verified_job(n integer) returns jsonb language sql stable as $$ select jsonb_build_object(
  'jobUrl','https://boards.greenhouse.io/verified-proof/jobs/'||n,'title','Software Engineer','company','Synthetic Employer '||n,
  'description','TypeScript required.','skills','["typescript"]'::jsonb,'location','Remote','remote',true,'country','US','postedAt',now()-interval '1 hour') $$;
-- A literal independently known group/fingerprint avoids a tautological fixture
-- that asks the migration itself to generate the decision it must validate.
create function public.test_verified_decision(status text default 'eligible_review') returns jsonb language sql immutable as $$
  select jsonb_build_object('status',status,'similarityKey','["verified-match-v1","software","unspecified",["core:typescript"],"US","remote",true]',
    'portal','greenhouse:boards.greenhouse.io/verified-proof','codes','[]'::jsonb,'reason','Factual gates passed','missingCore','[]'::jsonb,
    'requirements','[{"anyOf":["typescript"],"core":true,"evidence":"TypeScript required."}]'::jsonb)
$$;
create function public.test_verified_lease(n integer) returns jsonb language sql stable as $$
  select jsonb_build_object('taskId',id,'leaseVersion',lease_version,'leaseNonce',lease_nonce) from public.apply_tasks where id=public.test_verified_id(n)
$$;
create function public.test_verified_confirm(n integer) returns jsonb language sql immutable as $$
  select jsonb_build_object('taskId',public.test_verified_id(n),'profileRevision',1,'settingsRevision',1,'confirm',true)
$$;
create function public.test_verified_reserve(n integer,g uuid) returns jsonb language sql stable as $$ select
  public.test_verified_lease(n)||jsonb_build_object('grantId',g,'similarityKey',public.test_verified_decision()->>'similarityKey',
    'profileRevision',1,'settingsRevision',1,'answersRevision',1,'siteAllowed',true,'accountVerified',true,'requiredComplete',true,
    'answerIds','[]'::jsonb,'idempotencyKey','verified-proof:'||n)
$$;
create function public.test_verified_auto(n integer,g uuid) returns jsonb language plpgsql as $$ begin
  perform public.test_verified_worker('tasks.claim','{"limit":10}');
  return public.test_verified_worker('tasks.decide',public.test_verified_lease(n)||jsonb_build_object('decision',
    public.test_verified_decision('eligible_auto')||jsonb_build_object('grantId',g)));
end $$;
create function public.test_verified_observe(n integer) returns jsonb language plpgsql as $$
declare requested jsonb; command jsonb; before_at timestamptz; after_at timestamptz; before_probe jsonb; after_probe jsonb; args jsonb; v jsonb; begin
  requested:=public.test_verified_user('commands.request',jsonb_build_object('bindingId','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'type','open_manual','args',jsonb_build_object('taskId',public.test_verified_id(n))));
  select x into strict command from jsonb_array_elements(public.test_verified_worker('commands.claim')->'commands') x
    where x->>'id'=requested->'command'->>'id';
  perform public.test_apply_pipeline_assert(command->'job'=public.test_verified_job(n),'manual command is the exact owned job snapshot');
  perform public.test_verified_worker('sessions.report','{"portal":"greenhouse:boards.greenhouse.io/verified-proof","status":"authenticated","accountLabel":"synthetic@example.test"}');
  before_at:=clock_timestamp(); perform pg_sleep(0.01); after_at:=clock_timestamp();
  before_probe:=jsonb_build_object('jobUrl',public.test_verified_job(n)->>'jobUrl','checkedAt',before_at,'accountIdentity','synthetic@example.test',
    'session',jsonb_build_object('ok',true,'jobUrl',public.test_verified_job(n)->>'jobUrl','checkedAt',before_at),'receipt',null);
  after_probe:=before_probe||jsonb_build_object('checkedAt',after_at,'session',jsonb_build_object('ok',true,'jobUrl',public.test_verified_job(n)->>'jobUrl','checkedAt',after_at),
    'receipt',jsonb_build_object('selector','#application_confirmation','text','Your application has been received.','url',public.test_verified_job(n)->>'jobUrl'));
  args:=jsonb_build_object('commandId',command->>'id','claimNonce',command->>'claim_nonce','before',before_probe,'after',after_probe);
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.manual_observe'',%L)',args::text),'22023','unsupported action');
  perform public.test_verified_denied(format('select public.test_verified_worker(''learning.manual_observe'',%L)',
    (args||jsonb_build_object('before',before_probe||jsonb_build_object('receipt',after_probe->'receipt')))::text),'22023','new bound manual receipt required');
  v:=public.test_verified_worker('learning.manual_observe',args);
  perform public.test_apply_pipeline_assert(v->'receipt'->>'source'='worker' and v->'receipt'->>'observedAt' is not null
    and not v->'receipt' ? 'claim_nonce','only bound worker observation supplies credit');
  perform public.test_verified_denied(format('select public.test_verified_worker(''learning.manual_observe'',%L)',args::text),'22023','new bound manual receipt required');
  perform public.test_verified_worker('commands.report',jsonb_build_object('commandId',command->>'id','claimNonce',command->>'claim_nonce','status','done'));
  return v;
end $$;

insert into auth.users values ('55555555-5555-4555-8555-555555555555','synthetic@example.test'),('66666666-6666-4666-8666-666666666666','other-synthetic@example.test');
insert into public.entitlements(user_id,tier,addons) select id,'free','{"auto_apply":{"expires_at":null}}' from auth.users
  where id in ('55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666');
insert into public.apply_agent_bindings(id,user_id,token_hash,label) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','55555555-5555-4555-8555-555555555555',repeat('d',64),'Synthetic learning owner'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','66666666-6666-4666-8666-666666666666',repeat('e',64),'Synthetic other owner');
insert into public.apply_verified_profiles(user_id,revision,answers_revision,facts,resume_text,resume_approved) values
  ('55555555-5555-4555-8555-555555555555',1,1,jsonb_build_object(
    'skills',jsonb_build_object('value','["typescript"]'::jsonb,'source','user','confirmedAt',now()-interval '1 hour'),
    'role',jsonb_build_object('value','Software Engineer','source','user','confirmedAt',now()-interval '1 hour'),
    'locations',jsonb_build_object('value','["Remote"]'::jsonb,'source','user','confirmedAt',now()-interval '1 hour')),'Exact synthetic approved resume',true);
insert into public.apply_pipeline_settings(user_id,data) values ('55555555-5555-4555-8555-555555555555',
  '{"enabled":true,"autoSubmit":true,"threshold":60,"dailyCap":10,"weeklyCap":50,"employerDailyCap":2,"timeZone":"UTC","roles":[],"locations":[],"countries":[],"excludeCompanies":[],"requireWorkAuthorization":false,"allowSponsorship":true,"maxAgeDays":14,"aiConsent":false}');
insert into public.apply_runs(id,user_id,binding_id,mode,profile_revision,settings_revision,answers_revision) values
  ('ffffffff-ffff-4fff-8fff-ffffffffffff','55555555-5555-4555-8555-555555555555','dddddddd-dddd-4ddd-8ddd-dddddddddddd','auto',1,1,1);
insert into public.apply_tasks(id,user_id,run_id,target_binding_id,job_key,job,score,profile_revision,settings_revision,answers_revision)
  select public.test_verified_id(n),'55555555-5555-4555-8555-555555555555','ffffffff-ffff-4fff-8fff-ffffffffffff',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',public.apply_pipeline_job_key(public.test_verified_job(n)->>'jobUrl'),public.test_verified_job(n),100,1,1,1 from generate_series(1,6) n;

-- Replay preserves base identities, and neither SQL roles nor new tables widen.
do $$ declare r text; t text; j jsonb:=public.test_verified_job(1); fact jsonb; begin
  perform public.test_apply_pipeline_assert((select dispatcher='public.apply_pipeline_action_pre_learning(uuid,uuid,text,jsonb)'::regprocedure::oid
    and validator='public.apply_pipeline_validate_job_pre_learning(jsonb)'::regprocedure::oid
    and dispatcher<>'public.apply_pipeline_action(uuid,uuid,text,jsonb)'::regprocedure::oid from public.test_verified_learning_baseline),'replay retains historical dispatcher and validator identities');
  foreach r in array array['anon','authenticated','service_role'] loop
    perform public.test_apply_pipeline_assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'apply_pipeline_%' and has_function_privilege(r,p.oid,'execute')),'no role may invoke internal/base helpers');
    foreach t in array array['apply_match_feedback','apply_match_grants','apply_match_manual_receipts','apply_match_questions'] loop
      perform public.test_apply_pipeline_assert(not has_table_privilege(r,'public.'||t,'select,insert,update,delete'),'learning tables remain RPC-only');
    end loop;
  end loop;
  perform public.test_apply_pipeline_assert(has_function_privilege('authenticated','public.my_apply_pipeline_action(text,jsonb)','execute')
    and not has_function_privilege('anon','public.my_apply_pipeline_action(text,jsonb)','execute')
    and not has_function_privilege('service_role','public.my_apply_pipeline_action(text,jsonb)','execute')
    and has_function_privilege('service_role','public.service_apply_pipeline_dispatch(uuid,text,text,jsonb)','execute')
    and not has_function_privilege('authenticated','public.service_apply_pipeline_dispatch(uuid,text,text,jsonb)','execute')
    and not has_function_privilege('anon','public.service_apply_pipeline_dispatch(uuid,text,text,jsonb)','execute'),'only original public entrypoints are exposed');
  perform public.test_apply_pipeline_assert(not exists(select 1 from pg_policies where schemaname='public' and tablename in
    ('apply_match_feedback','apply_match_grants','apply_match_manual_receipts','apply_match_questions')),'no learning RLS policy widens access');
  perform public.test_apply_pipeline_assert(public.apply_pipeline_validate_job(j||'{"boardMatch":"HIGH"}')
    and not public.apply_pipeline_validate_job(j||'{"boardMatch":null}')
    and not public.apply_pipeline_validate_job(j||'{"boardMatch":"perfect"}')
    and not public.apply_pipeline_validate_job(j||'{"unexpected":true}'),'additive metadata keeps historical job schema closed');
  fact:=jsonb_build_object('value','["typescript"]'::jsonb,'source','user','confirmedAt',now()-interval '1 hour',
    'scope',jsonb_build_object('country','US','employer','Synthetic Employer 1','portal','greenhouse:boards.greenhouse.io/verified-proof','application',j->>'jobUrl'));
  perform public.test_apply_pipeline_assert(public.apply_pipeline_learning_scoped_fact(fact,j,clock_timestamp())
    and not public.apply_pipeline_learning_scoped_fact(jsonb_set(fact,'{scope,employer}','"Other employer"'),j,clock_timestamp()),'complete fact scope matches, not country alone');
end $$;
set local role service_role;
select public.test_verified_denied('select * from public.apply_match_feedback','42501','permission denied for table apply_match_feedback');
select public.test_verified_denied('select public.apply_pipeline_validate_job_pre_learning(''{}'')','42501','permission denied for function apply_pipeline_validate_job_pre_learning');
reset role;

-- The historical matcher checks sensitive facts by country. The additive safe
-- path must reject every other supplied scope key before accepting a decision.
savepoint legal_scope;
do $$ declare fact jsonb; args jsonb; begin
  fact:=jsonb_build_object('value',true,'source','user','confirmedAt',now()-interval '1 hour','scope',
    jsonb_build_object('country','US','employer','Other employer','portal','greenhouse:boards.greenhouse.io/verified-proof','application',public.test_verified_job(1)->>'jobUrl'));
  update public.apply_verified_profiles set facts=facts||jsonb_build_object('workAuthorization',fact)
    where user_id='55555555-5555-4555-8555-555555555555';
  update public.apply_pipeline_settings set data=jsonb_set(data,'{requireWorkAuthorization}','true')
    where user_id='55555555-5555-4555-8555-555555555555';
  perform public.test_verified_worker('tasks.claim','{"limit":10}');
  args:=public.test_verified_lease(1)||jsonb_build_object('decision',public.test_verified_decision());
  perform public.test_verified_denied(format('select public.test_verified_worker(''tasks.decide'',%L)',args::text),'42501','factual match gates failed');
  update public.apply_verified_profiles set facts=jsonb_set(facts,'{workAuthorization,scope}',
    jsonb_build_object('country','US','employer','Synthetic Employer 1','portal','greenhouse:boards.greenhouse.io/other','application',public.test_verified_job(1)->>'jobUrl'))
    where user_id='55555555-5555-4555-8555-555555555555';
  perform public.test_verified_denied(format('select public.test_verified_worker(''tasks.decide'',%L)',args::text),'42501','factual match gates failed');
end $$;
rollback to legal_scope;

-- Requirement-like clauses remain manual even when a posting omits marker words
-- such as "required" or "must". Recognizing TypeScript cannot erase Terraform,
-- quantified experience, or credentials elsewhere in the description.
do $$ begin
  perform public.test_apply_pipeline_assert(not public.apply_pipeline_learning_requirements_readable(
    public.test_verified_job(1)||jsonb_build_object('description','TypeScript. 5+ years of Terraform experience.')),
    'unmarked quantified experience remains manual');
  perform public.test_apply_pipeline_assert(not public.apply_pipeline_learning_requirements_readable(
    public.test_verified_job(1)||jsonb_build_object('description','TypeScript. Experience with Terraform.')),
    'unmarked unknown technology experience remains manual');
  perform public.test_apply_pipeline_assert(not public.apply_pipeline_learning_requirements_readable(
    public.test_verified_job(1)||jsonb_build_object('description','TypeScript. Bachelor''s degree in computer science.')),
    'unmarked education credential remains manual');
end $$;

-- Match questions are pending run work. Once the final pending task becomes a
-- manual receipt or explicit skip, the run must complete through the action.
savepoint waiting_match_run;
do $$ begin
  update public.apply_runs set status='running',started_at=now(),finished_at=null where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
  update public.apply_tasks set status='submitted' where run_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
  update public.apply_tasks set status='waiting_match_answer' where id=public.test_verified_id(1);
  perform public.apply_pipeline_refresh_run('ffffffff-ffff-4fff-8fff-ffffffffffff');
  perform public.test_apply_pipeline_assert((select status='running' and finished_at is null from public.apply_runs where id='ffffffff-ffff-4fff-8fff-ffffffffffff'),
    'waiting match answer keeps run pending');
end $$;
rollback to waiting_match_run;

savepoint manual_receipt_run;
do $$ begin
  update public.apply_runs set status='running',started_at=now(),finished_at=null where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
  update public.apply_tasks set status='submitted' where run_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
  update public.apply_tasks set status='waiting_review',match_decision=public.test_verified_decision()||jsonb_build_object(
    'eligible',true,'score',100,'profileRevision',1,'settingsRevision',1,'answersRevision',1,'jobUrl',job->>'jobUrl','decidedAt',now())
    where id=public.test_verified_id(1);
  perform public.test_verified_user('learning.manual_report',public.test_verified_confirm(1));
  perform public.test_apply_pipeline_assert((select status='completed' and finished_at is not null from public.apply_runs where id='ffffffff-ffff-4fff-8fff-ffffffffffff'),
    'final manual receipt completes run');
end $$;
rollback to manual_receipt_run;

savepoint skipped_run;
do $$ begin
  update public.apply_runs set status='running',started_at=now(),finished_at=null where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
  update public.apply_tasks set status='submitted' where run_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
  update public.apply_tasks set status='waiting_review',match_decision=public.test_verified_decision()||jsonb_build_object(
    'eligible',true,'score',100,'profileRevision',1,'settingsRevision',1,'answersRevision',1,'jobUrl',job->>'jobUrl','decidedAt',now())
    where id=public.test_verified_id(1);
  perform public.test_verified_user('learning.feedback',public.test_verified_confirm(1)||'{"scope":"exact","verdict":"skip"}');
  perform public.test_apply_pipeline_assert((select status='completed' and finished_at is not null from public.apply_runs where id='ffffffff-ffff-4fff-8fff-ffffffffffff'),
    'final explicit skip completes run');
end $$;
rollback to skipped_run;

-- A valid lease with safe factual overlap still cannot omit groups/fingerprint
-- or use the old reserve contract without explicit learned authority.
do $$ declare n integer; d jsonb; args jsonb; v jsonb; f jsonb; begin
  perform public.test_verified_worker('tasks.claim','{"limit":10}');
  foreach d in array array[public.test_verified_decision()-'requirements',public.test_verified_decision()||'{"requirements":[]}',
    public.test_verified_decision()-'similarityKey',public.test_verified_decision()||'{"similarityKey":"[\"spoof\"]"}'] loop
    perform public.test_verified_denied(format('select public.test_verified_worker(''tasks.decide'',%L)',
      (public.test_verified_lease(4)||jsonb_build_object('decision',d))::text),'22023','invalid grounded match decision');
  end loop;
  perform public.test_verified_denied(format('select public.test_verified_worker(''tasks.decide'',%L)',
    (public.test_verified_lease(4)||jsonb_build_object('decision',public.test_verified_decision('eligible_auto')))::text),'42501','current autonomy grant required');
  perform public.test_verified_denied(format('select public.test_verified_worker(''submission.reserve'',%L)',
    (public.test_verified_reserve(4,null)-'grantId'-'similarityKey')::text),'42501','stored safe auto decision required');
  for n in 1..5 loop perform public.test_verified_worker('tasks.decide',public.test_verified_lease(n)||jsonb_build_object('decision',public.test_verified_decision())); end loop;
  perform public.test_verified_worker('tasks.decide',public.test_verified_lease(6)||jsonb_build_object('decision',
    public.test_verified_decision('waiting_match_answer')||'{"question":{"kind":"skill_gap","skills":["python"],"text":"Confirm Python in your profile."}}'));
  v:=public.test_verified_user('learning.question',public.test_verified_confirm(6)||'{"answer":"yes"}');
  perform public.test_apply_pipeline_assert(v->'question'->>'suggestion'='profile_update'
    and (select facts->'skills'->'value'='["typescript"]'::jsonb from public.apply_verified_profiles where user_id='55555555-5555-4555-8555-555555555555'),'question suggestion never promotes facts');
  args:=public.test_verified_confirm(1)||'{"scope":"similar","verdict":"apply"}';
  perform public.test_verified_denied(format('select public.test_verified_worker(''learning.feedback'',%L)',args::text),'22023','unsupported action');
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.feedback'',%L)',(args||'{"source":"worker"}')::text),'22023','invalid args');
  f:=public.test_verified_user('learning.feedback',args)->'feedback';
  perform public.test_apply_pipeline_assert(f->>'source'='user' and f->>'profileRevision'='1' and f->>'settingsRevision'='1','user-only feedback provenance and revisions');
  perform public.test_verified_user('learning.feedback',args); -- replacement is one DISTINCT posting, not two votes
  perform public.test_verified_user('learning.feedback',public.test_verified_confirm(2)||'{"scope":"similar","verdict":"apply"}');
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.revoke'',%L,''66666666-6666-4666-8666-666666666666'')',
    jsonb_build_object('feedbackId',f->>'id')::text),'P0002','feedback not found');
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.feedback'',%L,''66666666-6666-4666-8666-666666666666'')',args::text),'P0002','task not found');
  perform public.test_apply_pipeline_assert(public.test_verified_user('learning.list','{}','66666666-6666-4666-8666-666666666666')->'learning'->'feedback'='[]'::jsonb
    and public.test_verified_worker('learning.list','{}',true)->'learning'->'feedback'='[]'::jsonb,'user and binding reads isolate other account');
  v:=public.test_verified_user('learning.manual_report',public.test_verified_confirm(3));
  perform public.test_apply_pipeline_assert(v->'receipt'->>'source'='user' and v->'receipt'->'observedAt'='null'::jsonb,'self report is not worker credit');
  perform public.test_apply_pipeline_assert((select x->>'observedManualReceiptCount'='0' from jsonb_array_elements(public.test_verified_user('learning.list')->'learning'->'eligibility') x
    where x->>'taskId'=public.test_verified_id(4)::text),'manual self report earns zero receipts');
  perform public.test_verified_observe(1);
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.grant'',%L)',
    (public.test_verified_confirm(4)||jsonb_build_object('expiresAt',now()+interval '1 day'))::text),'42501','three current similar apply jobs and two observed manual receipts plus safe task required');
  perform public.test_verified_observe(2);
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.grant'',%L)',
    (public.test_verified_confirm(4)||jsonb_build_object('expiresAt',now()+interval '1 day'))::text),'42501','three current similar apply jobs and two observed manual receipts plus safe task required');
  perform public.test_verified_user('learning.feedback',public.test_verified_confirm(3)||'{"scope":"similar","verdict":"apply"}');
  perform public.test_apply_pipeline_assert((select x->'eligible'='true'::jsonb and x->>'applySimilarCount'='3' and x->>'observedManualReceiptCount'='2'
    from jsonb_array_elements(public.test_verified_user('learning.list')->'learning'->'eligibility') x where x->>'taskId'=public.test_verified_id(4)::text),'three distinct similar applies plus two worker observations graduate');
  perform public.test_apply_pipeline_assert((select count(*)=0 from public.apply_match_grants where user_id='55555555-5555-4555-8555-555555555555'),'graduation is not implicit consent');
end $$;
create temp table verified_grant(id uuid);
do $$ declare args jsonb:=public.test_verified_confirm(4)||jsonb_build_object('expiresAt',now()+interval '1 day'); v jsonb; begin
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.grant'',%L)',(args-'confirm')::text),'22023','explicit user confirmation required');
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.grant'',%L)',(args||jsonb_build_object('expiresAt',now()+interval '31 days'))::text),'22023','explicit future expiry within 30 days required');
  v:=public.test_verified_user('learning.grant',args);
  insert into verified_grant values((v->'grant'->>'id')::uuid);
  perform public.test_apply_pipeline_assert(v->'grant'->>'source'='user','grant is explicitly user-authored');
end $$;
savepoint learned;

-- Each fence starts with a successfully accepted learned auto decision. Roll
-- back between cases so a different stale lease cannot explain the rejection.
do $$ declare g uuid:=(select id from verified_grant); args jsonb; begin
  perform public.test_apply_pipeline_assert(public.test_verified_auto(4,g)->'task'->>'status'='in_progress','current explicit grant accepts auto decision');
  args:=public.test_verified_reserve(4,g);
  perform public.test_verified_denied(format('select public.test_verified_worker(''submission.reserve'',%L,true)',args::text),'P0002','task not found');
  perform public.test_verified_denied(format('select public.test_verified_worker(''submission.reserve'',%L)',(args-'grantId')::text),'42501','stored safe auto decision required');
  perform public.test_verified_denied(format('select public.test_verified_worker(''submission.reserve'',%L)',(args-'similarityKey')::text),'42501','stored safe auto decision required');
  perform public.test_verified_user('learning.revoke',jsonb_build_object('grantId',g));
  perform public.test_apply_pipeline_assert((select lease_nonce is null from public.apply_tasks where id=public.test_verified_id(4)),'revocation fences current auto lease');
  perform public.test_verified_denied(format('select public.test_verified_worker(''submission.reserve'',%L)',args::text),'P0002','task not found');
end $$;
rollback to learned;
do $$ declare g uuid:=(select id from verified_grant); begin
  perform public.test_verified_auto(4,g);
  update public.apply_match_grants set granted_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=g;
  perform public.test_verified_denied(format('select public.test_verified_worker(''submission.reserve'',%L)',public.test_verified_reserve(4,g)::text),'42501','current scoped autonomy grant required');
end $$;
rollback to learned;
do $$ declare g uuid:=(select id from verified_grant); skip jsonb; begin
  perform public.test_verified_auto(4,g);
  skip:=public.test_verified_user('learning.feedback',public.test_verified_confirm(5)||'{"scope":"similar","verdict":"skip"}')->'feedback';
  perform public.test_apply_pipeline_assert((select revoked_at is not null from public.apply_match_grants where id=g)
    and (select lease_nonce is null and status='user_skipped' from public.apply_tasks where id=public.test_verified_id(4)),'similar skip revokes grant and fences pending auto');
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.grant'',%L)',
    (public.test_verified_confirm(4)||jsonb_build_object('expiresAt',now()+interval '1 day'))::text),'42501','three current similar apply jobs and two observed manual receipts plus safe task required');
  perform public.test_verified_user('learning.revoke',jsonb_build_object('feedbackId',skip->>'id'));
  perform public.test_apply_pipeline_assert((select status='user_skipped' and lease_nonce is null from public.apply_tasks where id=public.test_verified_id(4))
    and (select revoked_at is not null from public.apply_match_grants where id=g),'revoking skip never revives old authority');
end $$;
rollback to learned;
do $$ declare g uuid:=(select id from verified_grant); settings jsonb; begin
  perform public.test_verified_auto(4,g);
  settings:=public.test_verified_user('settings.get')->'settings';
  perform public.test_verified_user('settings.put',jsonb_build_object('expectedRevision',1,'settings',settings->'data'));
  perform public.test_apply_pipeline_assert((select revoked_at is not null from public.apply_match_grants where id=g)
    and (select bool_and(revoked_at is not null) from public.apply_match_feedback where user_id='55555555-5555-4555-8555-555555555555')
    and (select lease_nonce is null from public.apply_tasks where id=public.test_verified_id(4)),'settings revision revokes feedback/grant and fences auto');
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.feedback'',%L)',
    (public.test_verified_confirm(4)||'{"scope":"similar","verdict":"apply"}')::text),'40001','current stored match decision required');
end $$;
rollback to learned;
do $$ declare g uuid:=(select id from verified_grant); facts jsonb; begin
  perform public.test_verified_auto(4,g);
  select p.facts into facts from public.apply_verified_profiles p where user_id='55555555-5555-4555-8555-555555555555';
  perform public.test_verified_user('profile.confirm',jsonb_build_object('expectedRevision',1,'facts',facts,'resumeText','Exact synthetic approved resume','resumeApproved',true));
  perform public.test_apply_pipeline_assert((select revoked_at is not null from public.apply_match_grants where id=g)
    and (select revision=2 and answers_revision=2 from public.apply_verified_profiles where user_id='55555555-5555-4555-8555-555555555555')
    and (select lease_nonce is null from public.apply_tasks where id=public.test_verified_id(4)),'profile revision revokes grant and fences auto');
  perform public.test_verified_denied(format('select public.test_verified_user(''learning.grant'',%L)',
    (public.test_verified_confirm(4)||jsonb_build_object('expiresAt',now()+interval '1 day'))::text),'40001','current stored match decision required');
end $$;
rollback to learned;

-- Independently seed 205 rows per collection. The oldest active skip and grant
-- must survive pagination and be enforced by server queries, not page contents.
delete from public.apply_match_feedback where user_id='55555555-5555-4555-8555-555555555555';
delete from public.apply_match_grants where user_id='55555555-5555-4555-8555-555555555555';
delete from public.apply_match_manual_receipts where user_id='55555555-5555-4555-8555-555555555555';
delete from public.apply_match_questions where user_id='55555555-5555-4555-8555-555555555555';
delete from public.apply_binding_commands where user_id='55555555-5555-4555-8555-555555555555';
delete from public.apply_tasks where user_id='55555555-5555-4555-8555-555555555555';
insert into public.apply_tasks(id,user_id,run_id,target_binding_id,job_key,job,score,profile_revision,settings_revision,answers_revision,match_decision,created_at)
  select public.test_verified_id(n),'55555555-5555-4555-8555-555555555555','ffffffff-ffff-4fff-8fff-ffffffffffff','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    public.apply_pipeline_job_key(public.test_verified_job(n)->>'jobUrl'),public.test_verified_job(n),100,1,1,1,
    public.test_verified_decision()||jsonb_build_object('eligible',true,'score',100,'profileRevision',1,'settingsRevision',1,'answersRevision',1,'jobUrl',public.test_verified_job(n)->>'jobUrl'),
    now()-interval '1 day'+n*interval '1 second' from generate_series(1001,1205) n;
insert into public.apply_match_feedback(id,user_id,task_id,job_url,job_key,similarity_key,portal,scope,verdict,profile_revision,settings_revision,confirmed_at,revoked_at)
  select id,user_id,id,job->>'jobUrl',job_key,match_decision->>'similarityKey',match_decision->>'portal','similar',case when id=public.test_verified_id(1205) then 'skip' else 'apply' end,
    1,1,now()-right(id::text,12)::integer*interval '1 second',case when id=public.test_verified_id(1205) then null else now() end from public.apply_tasks where user_id='55555555-5555-4555-8555-555555555555';
insert into public.apply_match_grants(id,user_id,task_id,similarity_key,portal,profile_revision,settings_revision,granted_at,expires_at,revoked_at)
  select id,user_id,id,match_decision->>'similarityKey',match_decision->>'portal',1,1,now()-right(id::text,12)::integer*interval '1 second',now()+interval '1 day',
    case when id=public.test_verified_id(1205) then null else now() end from public.apply_tasks where user_id='55555555-5555-4555-8555-555555555555';
insert into public.apply_match_manual_receipts(id,user_id,task_id,job_url,job_key,similarity_key,portal,profile_revision,settings_revision,source,reported_at)
  select id,user_id,id,job->>'jobUrl',job_key,match_decision->>'similarityKey',match_decision->>'portal',1,1,'user',now()-right(id::text,12)::integer*interval '1 second'
  from public.apply_tasks where user_id='55555555-5555-4555-8555-555555555555';
insert into public.apply_match_questions(id,user_id,task_id,job_url,similarity_key,portal,profile_revision,settings_revision,question,answer,suggestion,answered_at)
  select id,user_id,id,job->>'jobUrl',match_decision->>'similarityKey',match_decision->>'portal',1,1,'{"kind":"skill_gap","skills":["python"],"text":"Confirm Python."}','unsure','none',
    now()-right(id::text,12)::integer*interval '1 second' from public.apply_tasks where user_id='55555555-5555-4555-8555-555555555555';
do $$ declare first_page jsonb; last_page jsonb; empty_page jsonb; collection text; combined jsonb; args jsonb; begin
  first_page:=public.test_verified_user('learning.list'); last_page:=public.test_verified_user('learning.list','{"limit":200,"offset":200}');
  perform public.test_apply_pipeline_assert(first_page->'hasMore'='true'::jsonb and last_page->'hasMore'='false'::jsonb
    and public.test_verified_worker('learning.list')=first_page,'worker/user stable page contract signals continuation');
  empty_page:=public.test_verified_user('learning.list','{"offset":205}');
  foreach collection in array array['feedback','grants','receipts','questions','eligibility'] loop
    combined:=(first_page->'learning'->collection)||(last_page->'learning'->collection);
    perform public.test_apply_pipeline_assert(jsonb_array_length(first_page->'learning'->collection)=200
      and jsonb_array_length(last_page->'learning'->collection)=5 and empty_page->'learning'->collection='[]'::jsonb
      and (select count(distinct x->>'taskId')=205 from jsonb_array_elements(combined) x)
      and (select jsonb_agg(x->>'taskId' order by ord) from jsonb_array_elements(combined) with ordinality a(x,ord))=
        (select jsonb_agg(public.test_verified_id(n)::text order by n) from generate_series(1001,1205) n),'every older row retained in '||collection);
  end loop;
  perform public.test_apply_pipeline_assert(last_page->'learning'->'feedback'->4->>'verdict'='skip'
    and last_page->'learning'->'feedback'->4->'revokedAt'='null'::jsonb and last_page->'learning'->'grants'->4->'revokedAt'='null'::jsonb,'older active veto and grant visible');
  perform public.test_verified_worker('tasks.claim','{"limit":10}');
  perform public.test_verified_denied(format('select public.test_verified_worker(''tasks.decide'',%L)',
    (public.test_verified_lease(1001)||jsonb_build_object('decision',public.test_verified_decision()))::text),'42501','factual match gates failed');
  -- Remove only the synthetic veto, keeping the independently seeded older grant.
  update public.apply_match_feedback set revoked_at=now() where id=public.test_verified_id(1205);
  perform public.test_verified_worker('tasks.decide',public.test_verified_lease(1001)||jsonb_build_object('decision',
    public.test_verified_decision('eligible_auto')||jsonb_build_object('grantId',public.test_verified_id(1205))));
  perform public.test_apply_pipeline_assert(public.test_verified_worker('submission.reserve',public.test_verified_reserve(1001,public.test_verified_id(1205)))->'reservation'->>'task_id'=public.test_verified_id(1001)::text,'older active grant found beyond first 200 rows');
  foreach args in array array['{"limit":0}'::jsonb,'{"limit":201}','{"limit":null}','{"limit":"10"}','{"offset":-1}','{"offset":0.5}','{"offset":null}','{"offset":2147483648}'] loop
    perform public.test_verified_denied(format('select public.test_verified_user(''learning.list'',%L)',args::text),'22023',case when args ? 'limit' then 'invalid learning limit' else 'invalid learning offset' end);
  end loop;
end $$;
delete from public.apply_match_grants where user_id='55555555-5555-4555-8555-555555555555';
delete from public.apply_match_manual_receipts where user_id='55555555-5555-4555-8555-555555555555';
delete from public.apply_match_questions where user_id='55555555-5555-4555-8555-555555555555';
update public.apply_tasks set match_decision=null where user_id='55555555-5555-4555-8555-555555555555';
select public.test_apply_pipeline_assert(public.test_verified_user('learning.list')->'hasMore'='true'::jsonb,'continuation is OR across collections, even feedback alone');
rollback to learned;

-- Preserve original reserve guards AFTER accepting a current learned grant.
-- Fixture-only settings changes deliberately keep revisions fixed to reach the
-- old guards; public settings.put revision fencing was verified separately.
do $$ declare g uuid:=(select id from verified_grant); args jsonb; guard text; v jsonb; finish jsonb; before_nonce uuid; begin
  perform public.test_apply_pipeline_assert(public.test_verified_auto(4,g)->'task'->>'status'='in_progress','valid learned grant reaches historical reserve guards');
  args:=public.test_verified_reserve(4,g);
  foreach guard in array array['dailyCap','weeklyCap','employerDailyCap'] loop
    update public.apply_pipeline_settings set data=jsonb_set(data,array[guard],'0') where user_id='55555555-5555-4555-8555-555555555555';
    perform public.test_verified_denied(format('select public.test_verified_worker(''submission.reserve'',%L)',args::text),'42501','submission cap reached');
    update public.apply_pipeline_settings set data=jsonb_set(data,array[guard],case guard when 'dailyCap' then '10'::jsonb when 'weeklyCap' then '50'::jsonb else '2'::jsonb end)
      where user_id='55555555-5555-4555-8555-555555555555';
  end loop;
  update public.apply_pipeline_settings set data=data||'{"quietFrom":"00:00","quietTo":"00:00"}' where user_id='55555555-5555-4555-8555-555555555555';
  perform public.test_verified_denied(format('select public.test_verified_worker(''submission.reserve'',%L)',args::text),'42501','quiet hours');
  update public.apply_pipeline_settings set data=data-'quietFrom'-'quietTo' where user_id='55555555-5555-4555-8555-555555555555';
  foreach guard in array array['siteAllowed','accountVerified','requiredComplete'] loop
    perform public.test_verified_denied(format('select public.test_verified_worker(''submission.reserve'',%L)',jsonb_set(args,array[guard],'false')::text),'22023','submit guards required');
  end loop;
  perform public.test_apply_pipeline_assert((select count(*)=0 from public.apply_submission_reservations where user_id='55555555-5555-4555-8555-555555555555'),'guard failures never cross reserve boundary');
  v:=public.test_verified_worker('submission.reserve',args)->'reservation';
  perform public.test_apply_pipeline_assert(v->>'task_id'=public.test_verified_id(4)::text and v->>'status'='reserved','same valid grant and lease reserve successfully once guards pass');
  finish:=public.test_verified_lease(4)||jsonb_build_object('reservationId',v->>'id','reservationNonce',v->>'nonce','outcome','submitted',
    'evidence',jsonb_build_object('kind','receipt','text','Your application has been received.','url',public.test_verified_job(4)->>'jobUrl'));
  perform public.test_verified_denied(format('select public.test_verified_worker(''submission.finish'',%L)',
    (finish||jsonb_build_object('reservationNonce',public.test_verified_id(900)))::text),'P0002','reservation not found');
  perform public.test_verified_denied(format('select public.test_verified_worker(''submission.finish'',%L)',
    jsonb_set(finish,'{evidence,url}',to_jsonb(public.test_verified_job(1)->>'jobUrl'))::text),'22023','positive submission evidence required');
  select lease_nonce into before_nonce from public.apply_tasks where id=public.test_verified_id(4);
  perform public.test_verified_user('learning.revoke',jsonb_build_object('grantId',g));
  perform public.test_apply_pipeline_assert((select status='submitting' and lease_nonce=before_nonce from public.apply_tasks where id=public.test_verified_id(4)),'grant revoke preserves irreversible finish lease');
  perform public.test_apply_pipeline_assert(public.test_verified_worker('submission.finish',finish)->'reservation'->>'status'='submitted'
    and public.test_verified_worker('submission.finish',finish)->'reservation'->>'status'='submitted','correct finish nonce still succeeds and is idempotent');
  perform public.test_verified_denied(format('select public.test_verified_worker(''submission.reserve'',%L)',args::text),'40001','stale task lease');
end $$;
rollback;

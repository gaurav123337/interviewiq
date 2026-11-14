-- Disposable pipeline fixture only. Run after contract/matching suites; each
-- race lane below uses a different binding of the SAME owner and cap slot.
update public.apply_pipeline_settings set data=data||'{"dailyCap":1,"employerDailyCap":1}'
  where user_id='22222222-2222-4222-8222-222222222222';
update public.apply_tasks set status='in_progress',lease_version=1,lease_nonce=gen_random_uuid(),lease_until=now()+interval '5 minutes',
  claimed_by=case when job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/2' then 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid else 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid end,
  target_binding_id=case when job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/2' then 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid else 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid end
  where user_id='22222222-2222-4222-8222-222222222222' and job->>'jobUrl' in ('https://boards.greenhouse.io/proof/jobs/1','https://boards.greenhouse.io/proof/jobs/2');

create or replace function public.test_apply_pipeline_reserve_lane(p_lane integer)
returns jsonb language plpgsql as $$
declare t public.apply_tasks%rowtype; v_binding uuid; v_hash text; begin
  if p_lane not in (1,2) then raise exception 'invalid test lane'; end if;
  select * into strict t from public.apply_tasks where user_id='22222222-2222-4222-8222-222222222222'
    and job->>'jobUrl'='https://boards.greenhouse.io/proof/jobs/'||p_lane;
  v_binding:=case when p_lane=1 then 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid else 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid end;
  v_hash:=repeat(case when p_lane=1 then 'a' else 'c' end,64);
  return public.service_apply_pipeline_dispatch(v_binding,v_hash,'submission.reserve',jsonb_build_object(
    'taskId',t.id,'leaseVersion',t.lease_version,'leaseNonce',t.lease_nonce,'profileRevision',t.profile_revision,
    'settingsRevision',t.settings_revision,'answersRevision',t.answers_revision,'siteAllowed',true,'accountVerified',true,
    'requiredComplete',true,'answerIds','[]'::jsonb,'idempotencyKey','race:'||p_lane));
end $$;

-- Runner launches these in TWO simultaneous psql sessions, ON_ERROR_STOP=1:
-- begin; select set_config('request.jwt.claim.role','service_role',true);
-- select public.test_apply_pipeline_reserve_lane(1); select pg_sleep(0.3); commit;
-- begin; select set_config('request.jwt.claim.role','service_role',true);
-- select public.test_apply_pipeline_reserve_lane(2); select pg_sleep(0.3); commit;
-- Exactly one exits successfully; the other must report submission cap reached.

-- Run after the two concurrent test_apply_pipeline_reserve_lane sessions.
do $$ begin
  perform public.test_apply_pipeline_assert((select count(*)=1 from public.apply_submission_reservations
    where user_id='22222222-2222-4222-8222-222222222222'),'two bindings share exactly one last daily/employer slot');
  perform public.test_apply_pipeline_assert((select count(*)=1 from public.apply_tasks
    where user_id='22222222-2222-4222-8222-222222222222' and status='submitting'),'only accepted lane crosses irreversible submit boundary');
  perform public.test_apply_pipeline_assert((select count(*)=1 from public.apply_tasks
    where user_id='22222222-2222-4222-8222-222222222222' and job->>'jobUrl' in ('https://boards.greenhouse.io/proof/jobs/1','https://boards.greenhouse.io/proof/jobs/2') and status='in_progress'),'rejected lane has no reservation and remains pre-submit');
end $$;

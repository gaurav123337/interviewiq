/* Contract only after a paired owner agent and two-user smoke tests succeed.
   Disable old global private-data APIs, including service-key callers; the
   legacy engine's core transport now uses the verified owner dispatcher too.
   Rollback must not restore these unsafe readers or remove tenant ownership. */
do $$
declare t text; f record;
begin
  if to_regclass('public.apply_tenant_rollout') is null
    or to_regclass('public.apply_agent_bindings') is null
    or to_regprocedure('public.my_apply_action(text,jsonb)') is null then
    raise exception 'tenant and pairing expansion must be applied first';
  end if;
  if current_setting('app.apply_scoped_smoke_verified', true) is distinct from 'true' then
    raise exception 'explicit completed scoped smoke-test verification required';
  end if;
  if not exists(select 1 from public.apply_agent_bindings b join public.apply_tenant_rollout r
    on b.user_id = r.legacy_user_id where r.id and b.revoked_at is null and b.last_used_at is not null) then
    raise exception 'verified owner agent has not completed its paired smoke test';
  end if;
  foreach t in array array['apply_results','job_apply_reviews','apply_resume_variants',
    'form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes'] loop
    execute format('alter table public.%I alter column user_id drop default', t);
  end loop;
  update public.apply_tenant_rollout set legacy_enabled = false where id;

  for f in select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'admin_list_apply_results','engine_record_apply_result','engine_list_apply_results_for_host',
      'admin_list_job_reviews','admin_resolve_job_review','admin_unresolve_job_review',
      'admin_list_resolved_job_reviews','engine_queue_job_review','engine_has_pending_review',
      'engine_list_reviewed_urls','engine_resolve_review_by_url','engine_put_form_answer',
      'engine_get_form_answers','engine_touch_form_answers','admin_form_answer_stats',
      'engine_put_resume_variant','engine_latest_resume_variant','admin_list_resume_variants',
      'admin_approve_resume_variant','engine_apply_feedback','engine_get_skill_strikes',
      'admin_get_skill_strikes','admin_put_judge_exemplar','engine_get_judge_exemplars',
      'admin_list_judge_exemplars','admin_delete_judge_exemplar','engine_record_apply_outcome',
      'admin_apply_outcome_digest','engine_outcome_stats','admin_apply_weekly_digest',
      'admin_get_notify_config','engine_notify_config','admin_list_user_notify',
      'admin_user_usage','admin_user_apply_rows','admin_user_review_rows','admin_user_notify_row'
    ]) loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f.signature);
  end loop;
end $$;

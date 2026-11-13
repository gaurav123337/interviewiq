/* Close the legacy global readers before any purchaser UI is re-enabled.
   Own-content reads now use my_apply_action; support gets counts only. This
   whitelist tolerates optional feature SQL that has not yet been installed. */
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'admin_list_apply_results','admin_list_job_reviews','admin_list_resolved_job_reviews',
      'admin_list_resume_variants','admin_form_answer_stats','admin_get_skill_strikes',
      'admin_list_judge_exemplars','admin_get_notify_config','admin_apply_weekly_digest',
      'admin_apply_outcome_digest','admin_user_usage','admin_user_apply_rows','admin_user_review_rows',
      'admin_user_notify_row','admin_list_user_notify','engine_get_judge_exemplars',
      'engine_get_form_answers','engine_get_skill_strikes','engine_list_reviewed_urls',
      'engine_has_pending_review','engine_outcome_stats','engine_notify_config','engine_list_apply_results_for_host','engine_get_apply_policy',
      'engine_record_apply_result','engine_queue_job_review','engine_resolve_review_by_url',
      'engine_put_form_answer','engine_touch_form_answers','engine_put_resume_variant',
      'engine_latest_resume_variant','engine_apply_feedback','engine_record_apply_outcome',
      'admin_resolve_job_review','admin_unresolve_job_review','admin_approve_resume_variant',
      'admin_put_judge_exemplar','admin_delete_judge_exemplar'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end $$;

/* Remaining global lifecycle/config reads stay usable only by the actual admin.
   Existing sensitive bodies are moved to a non-exposed schema and wrapped with
   a body guard. Return types and argument defaults are copied from pg_proc so
   installed optional variants do not depend on a guessed historical signature. */
create schema if not exists apply_private;
revoke all on schema apply_private from public, anon, authenticated;
do $$
declare f record; v_name text; v_args text; v_call text; v_result text; v_body text;
begin
  for f in
    select p.*, p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'admin_get_apply_config','admin_engine_state','admin_engine_events','admin_login_status','admin_run_status'
    ]) and p.prosecdef
  loop
    v_name := f.proname;
    /* A replay finds the public guarded wrapper; its implementation is already
       in apply_private, so never move a wrapper onto itself. */
    if exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'apply_private' and p.proname = v_name and p.proargtypes = f.proargtypes) then continue; end if;
    v_args := pg_get_function_arguments(f.oid);
    v_result := pg_get_function_result(f.oid);
    select string_agg('$' || i::text, ', ' order by i) into v_call from generate_series(1, f.pronargs) i;
    v_call := coalesce(v_call, '');
    execute format('alter function %s set schema apply_private', f.signature);
    execute format('revoke all on function apply_private.%I(%s) from public, anon, authenticated', v_name, pg_get_function_identity_arguments(f.oid));
    v_body := format('begin if not (public.is_admin() or coalesce(auth.jwt()->>''role'','''') = ''service_role'') then raise exception ''forbidden''; end if; return query select * from apply_private.%I(%s); end', v_name, v_call);
    execute format('create function public.%I(%s) returns %s language plpgsql security definer set search_path = public, pg_temp as %L', v_name, v_args, v_result, v_body);
    execute format('revoke all on function public.%I(%s) from public, anon', v_name, pg_get_function_identity_arguments(f.oid));
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', v_name, pg_get_function_identity_arguments(f.oid));
  end loop;
end $$;

/* A token prefix/chat id is private content too; summary-only support does not
   need it, and ordinary table RLS must not grant an administrator the full bot. */
drop policy if exists "user notify admin read" on public.user_notify_config;

create or replace function public.admin_user_apply_summary(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_results bigint; v_reviews bigint; v_variants bigint; v_last timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user is null then raise exception 'user required'; end if;
  if not exists(select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'apply_results' and column_name = 'user_id') then
    return jsonb_build_object('available', false);
  end if;
  execute 'select count(*), max(created_at) from public.apply_results where user_id = $1'
    into v_results, v_last using p_user;
  execute 'select count(*) from public.job_apply_reviews where user_id = $1' into v_reviews using p_user;
  execute 'select count(*) from public.apply_resume_variants where user_id = $1' into v_variants using p_user;
  return jsonb_build_object('available', true, 'result_count', v_results, 'review_count', v_reviews,
    'variant_count', v_variants, 'last_activity', v_last);
end $$;
revoke all on function public.admin_user_apply_summary(uuid) from public, anon;
grant execute on function public.admin_user_apply_summary(uuid) to authenticated;

create or replace function public.admin_list_notify_summary()
returns table(user_id uuid, email text, bound boolean, updated_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select n.user_id, p.email,
    coalesce(n.chat_id <> '' and n.bot_token <> '', false), n.updated_at
    from public.user_notify_config n left join public.profiles p on p.id = n.user_id
    order by n.updated_at desc;
end $$;
revoke all on function public.admin_list_notify_summary() from public, anon;
grant execute on function public.admin_list_notify_summary() to authenticated;

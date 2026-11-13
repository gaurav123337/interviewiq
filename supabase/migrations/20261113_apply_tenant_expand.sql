/* Expand the auto-apply core without guessing who owns legacy rows.
   Apply after the feature SQL and complimentary-grants migration. The runner
   supplies app.apply_legacy_user_id AND app.apply_legacy_email in the same
   transaction; without a verified pair this migration aborts before backfill.
   No customer agent receives the service key: apply-agent validates its token
   and supplies p_user to the service-only dispatcher below. */

create table if not exists public.apply_tenant_rollout (
  id boolean primary key default true check (id),
  legacy_user_id uuid not null references auth.users(id),
  legacy_enabled boolean not null default true,
  migrated_at timestamptz not null default now()
);
alter table public.apply_tenant_rollout enable row level security;
revoke all on public.apply_tenant_rollout from public, anon, authenticated;

do $$
declare
  v_user uuid := nullif(current_setting('app.apply_legacy_user_id', true), '')::uuid;
  v_email text := lower(nullif(current_setting('app.apply_legacy_email', true), ''));
  v_existing uuid;
begin
  select legacy_user_id into v_existing from public.apply_tenant_rollout where id;
  if exists(select 1 from public.apply_tenant_rollout where id and not legacy_enabled) then
    raise exception 'contracted tenant rollout cannot be expanded again';
  end if;
  if v_user is null or v_email is null or not exists (
    select 1 from auth.users where id = v_user and lower(email) = v_email
  ) then raise exception 'explicit verified legacy owner UUID and email required'; end if;
  if v_existing is not null and v_existing <> v_user then
    raise exception 'legacy owner cannot change on migration replay';
  end if;
  insert into public.apply_tenant_rollout(id, legacy_user_id) values (true, v_user)
    on conflict (id) do nothing;
end $$;

/* Legacy defaults exist only for the trusted owner engine during expansion.
   They cannot be used by an authenticated customer's direct table insert. */
create or replace function public.apply_legacy_user_id()
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'legacy engine requires service role';
  end if;
  select legacy_user_id into v_user from public.apply_tenant_rollout where id and legacy_enabled;
  if v_user is null then raise exception 'legacy engine disabled'; end if;
  return v_user;
end $$;
revoke all on function public.apply_legacy_user_id() from public, anon, authenticated;
grant execute on function public.apply_legacy_user_id() to service_role;

/* Fail before any changes if a feature prerequisite is missing. Do not silently
   omit an uninstalled private table and claim isolation has been completed. */
do $$
declare t text; v_owner uuid;
begin
  select legacy_user_id into v_owner from public.apply_tenant_rollout where id;
  foreach t in array array['apply_results','job_apply_reviews','apply_resume_variants',
    'form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes'] loop
    if to_regclass('public.' || t) is null then raise exception 'missing prerequisite table: %', t; end if;
    execute format('alter table public.%I add column if not exists user_id uuid references auth.users(id) on delete cascade', t);
    execute format('update public.%I set user_id = $1 where user_id is null', t) using v_owner;
    execute format('alter table public.%I alter column user_id set not null', t);
    execute format('alter table public.%I alter column user_id set default public.apply_legacy_user_id()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

do $$
declare t text; p record;
begin
  foreach t in array array['apply_results','job_apply_reviews','apply_resume_variants',
    'form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy apply_core_own_read on public.%I for select to authenticated using (auth.uid() = user_id)', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_tenant_idx', t);
  end loop;
end $$;

/* Global uniqueness would make user B collide with user A's URL/answer/hash. */
alter table public.job_apply_reviews drop constraint if exists job_apply_reviews_site_host_job_url_key;
alter table public.form_answers drop constraint if exists form_answers_site_host_field_key_key;
alter table public.apply_skill_strikes drop constraint if exists apply_skill_strikes_site_host_skill_key;
alter table public.apply_outcomes drop constraint if exists apply_outcomes_job_url_key;
drop index if exists public.apply_resume_variants_dedupe_idx;
drop index if exists public.judge_exemplars_dedupe_idx;
create unique index if not exists job_apply_reviews_tenant_key on public.job_apply_reviews(user_id, site_host, job_url);
create unique index if not exists form_answers_tenant_key on public.form_answers(user_id, site_host, field_key);
create unique index if not exists apply_skill_strikes_tenant_key on public.apply_skill_strikes(user_id, site_host, skill);
create unique index if not exists apply_outcomes_tenant_key on public.apply_outcomes(user_id, job_url);
create unique index if not exists apply_resume_variants_tenant_key on public.apply_resume_variants(user_id, job_url, variant_id);
create unique index if not exists judge_exemplars_tenant_key on public.judge_exemplars(user_id, kind, left(lower(summary), 200));

alter table public.apply_results drop constraint if exists apply_results_result_check;
alter table public.apply_results add constraint apply_results_result_check
  check (result in ('submitted','needs_review','skipped','error','budget_capped','filtered'));
alter table public.job_apply_reviews drop constraint if exists job_apply_reviews_status_check;
alter table public.job_apply_reviews add constraint job_apply_reviews_status_check
  check (status in ('pending','done','dismissed','closed'));

/* Engine retries must not duplicate result history after a lost HTTP response. */
alter table public.apply_results add column if not exists agent_event_id uuid;
create unique index if not exists apply_results_agent_event_key on public.apply_results(user_id, agent_event_id)
  where agent_event_id is not null;

/* Notifications remain owner-private, including from administrators. */
drop policy if exists "user notify admin read" on public.user_notify_config;
drop policy if exists "user notify own" on public.user_notify_config;
create policy "user notify own" on public.user_notify_config for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.user_notify_config from public, anon;
grant select, insert, update, delete on public.user_notify_config to authenticated;

/* One fixed dispatcher owns decisions; neither endpoint accepts arbitrary SQL,
   a function name, a table name, nor a customer-selected authoritative UUID.
   Self-service wrapper below derives auth.uid(); the Edge wrapper is service-only. */
create or replace function public.apply_core_action(p_user uuid, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_result jsonb;
  v_id uuid;
  v_url text;
  v_key text;
  v_status text;
  v_skill text;
  v_limit int := least(greatest(coalesce((p_args->>'limit')::int, 100), 1), 500);
  v_write boolean;
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then raise exception 'invalid owner'; end if;
  if p_args is null or jsonb_typeof(p_args) <> 'object' then raise exception 'args must be an object'; end if;
  if p_args ?| array['user_id','userId','p_user','p_user_id'] then raise exception 'owner is derived from authentication'; end if;
  v_write := p_action = any(array['results.record','reviews.queue','reviews.resolve','reviews.resolve_url',
    'reviews.unresolve','variants.put','variants.approve','memory.put','memory.touch','strikes.clear',
    'exemplars.put','exemplars.delete','feedback.put','outcomes.record']);
  if v_write and not public.has_auto_apply_access(p_user) then raise exception 'auto-apply entitlement required'; end if;

  case p_action
  when 'sites.list' then
    /* Curated public catalog only; no private credential/session/rules blobs. */
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select id, host, label, jobs_url, source, 'active'::text as status, '{}'::jsonb as rules
      from public.job_sites where status = 'active' and source in ('builtin','ats') order by host
    ) x;
  when 'results.list' then
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select id, site_host, job_url, title, company, result, detail, fit, posted_age_h, feedback, created_at
      from public.apply_results where user_id = p_user
        and (p_args->>'host' is null or site_host = p_args->>'host')
      order by created_at desc, id desc limit v_limit
    ) x;
  when 'results.record' then
    if p_args->>'result' is null or p_args->>'result' not in ('submitted','needs_review','skipped','error','budget_capped','filtered') then
      raise exception 'bad result';
    end if;
    if coalesce(p_args->>'jobUrl', '') = '' or coalesce(p_args->>'siteHost', '') = '' then raise exception 'site and job URL required'; end if;
    insert into public.apply_results(user_id, site_host, job_url, title, company, result, detail, fit, posted_age_h, agent_event_id)
    values (p_user, left(p_args->>'siteHost', 255), left(p_args->>'jobUrl', 4096), left(p_args->>'title', 500),
      left(p_args->>'company', 500), p_args->>'result', left(p_args->>'detail', 4000),
      (p_args->>'fit')::int, (p_args->>'ageH')::int, (p_args->>'eventId')::uuid)
    on conflict (user_id, agent_event_id) where agent_event_id is not null do nothing;
    v_result := 'null';
  when 'reviews.list', 'reviews.resolved' then
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select id, site_host, job_url, title, company, form_url, reason, fit, form_fields,
        posted_age_h, created_at, status, resolved_at
      from (
        select r.*, row_number() over (partition by r.user_id, public.review_posting_key(r.job_url)
          order by coalesce(r.resolved_at, r.created_at) desc, r.id desc) as rn
        from public.job_apply_reviews r where r.user_id = p_user
          and ((p_action = 'reviews.list' and r.status = 'pending') or
            (p_action = 'reviews.resolved' and r.status in ('done','dismissed','closed')))
      ) ranked where rn = 1 order by coalesce(resolved_at, created_at) desc limit v_limit
    ) x;
  when 'reviews.queue' then
    v_url := p_args->>'jobUrl';
    if coalesce(v_url, '') = '' or coalesce(p_args->>'siteHost', '') = '' then raise exception 'site and job URL required'; end if;
    /* Resolved normalized twins stay resolved; never resurrect dismissed work. */
    if exists (select 1 from public.job_apply_reviews where user_id = p_user
      and public.review_posting_key(job_url) = public.review_posting_key(v_url) and status <> 'pending') then return 'null'; end if;
    insert into public.job_apply_reviews(user_id, site_host, job_url, title, company, form_url, reason, fit, form_fields, posted_age_h)
    values (p_user, left(p_args->>'siteHost', 255), left(v_url, 4096), left(p_args->>'title', 500), left(p_args->>'company', 500),
      left(p_args->>'formUrl', 4096), left(p_args->>'reason', 4000), (p_args->>'fit')::int,
      p_args->'formFields', (p_args->>'ageH')::int)
    on conflict (user_id, site_host, job_url) do update set reason = excluded.reason,
      fit = coalesce(excluded.fit, job_apply_reviews.fit), form_fields = coalesce(excluded.form_fields, job_apply_reviews.form_fields),
      form_url = coalesce(excluded.form_url, job_apply_reviews.form_url),
      title = coalesce(excluded.title, job_apply_reviews.title), company = coalesce(excluded.company, job_apply_reviews.company),
      posted_age_h = coalesce(excluded.posted_age_h, job_apply_reviews.posted_age_h);
    v_result := 'null';
  when 'reviews.resolve', 'reviews.unresolve', 'reviews.resolve_url' then
    v_status := case when p_action = 'reviews.unresolve' then 'pending' else p_args->>'status' end;
    if v_status is null or v_status not in ('pending','done','dismissed','closed')
      or (v_status = 'pending' and p_action <> 'reviews.unresolve') then raise exception 'bad review status'; end if;
    if p_action = 'reviews.resolve_url' then
      v_key := public.review_posting_key(p_args->>'jobUrl');
    else
      select public.review_posting_key(job_url) into v_key from public.job_apply_reviews
        where id = (p_args->>'id')::uuid and user_id = p_user;
      if not found then raise exception 'review not found'; end if;
    end if;
    if coalesce(v_key, '') = '' then raise exception 'job URL required'; end if;
    update public.job_apply_reviews set status = v_status,
      resolved_at = case when v_status = 'pending' then null else now() end
      where user_id = p_user and public.review_posting_key(job_url) = v_key;
    v_result := 'null';
  when 'reviews.has_pending' then
    select to_jsonb(exists(select 1 from public.job_apply_reviews where user_id = p_user and status = 'pending'
      and public.review_posting_key(job_url) = public.review_posting_key(p_args->>'jobUrl'))) into v_result;
  when 'reviews.reviewed_urls' then
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select distinct on (public.review_posting_key(job_url)) job_url, status as review_status
      from public.job_apply_reviews where user_id = p_user and status <> 'pending'
      order by public.review_posting_key(job_url), resolved_at desc, id desc
    ) x;
  when 'variants.list' then
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select id, site_host, job_url, title, company, master_text, variant_text, diff_summary,
        variant_id, approved, created_at, approved_at from public.apply_resume_variants
      where user_id = p_user order by created_at desc, id desc limit v_limit
    ) x;
  when 'variants.put' then
    if coalesce(p_args->>'jobUrl', '') = '' or coalesce(p_args->>'variantId', '') = '' then raise exception 'job URL and variant hash required'; end if;
    insert into public.apply_resume_variants(user_id, job_url, site_host, title, company, master_text, variant_text, diff_summary, variant_id)
    values (p_user, left(p_args->>'jobUrl', 4096), left(p_args->>'siteHost', 255), left(p_args->>'title', 500),
      left(p_args->>'company', 500), left(p_args->>'masterText', 100000), left(p_args->>'variantText', 100000),
      p_args->'diffSummary', left(p_args->>'variantId', 64))
    on conflict (user_id, job_url, variant_id) do update set
      approved = case when apply_resume_variants.variant_text is distinct from excluded.variant_text
        then false else apply_resume_variants.approved end,
      approved_at = case when apply_resume_variants.variant_text is distinct from excluded.variant_text
        then null else apply_resume_variants.approved_at end,
      master_text = excluded.master_text, variant_text = excluded.variant_text, diff_summary = excluded.diff_summary
    returning id into v_id;
    v_result := to_jsonb(v_id);
  when 'variants.latest' then
    select to_jsonb(x) into v_result from (
      select id, variant_id, approved, created_at from public.apply_resume_variants
      where user_id = p_user and job_url = p_args->>'jobUrl' order by created_at desc, id desc limit 1
    ) x;
  when 'variants.approve' then
    if jsonb_typeof(p_args->'approved') is distinct from 'boolean' then raise exception 'approved must be boolean'; end if;
    update public.apply_resume_variants set approved = (p_args->>'approved')::boolean,
      approved_at = case when (p_args->>'approved')::boolean then now() end
      where user_id = p_user and id = (p_args->>'id')::uuid;
    if not found then raise exception 'variant not found'; end if;
    v_result := 'null';
  when 'memory.get' then
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select field_key, answer from public.form_answers where user_id = p_user and site_host = p_args->>'siteHost'
    ) x;
  when 'memory.put' then
    if coalesce(p_args->>'siteHost', '') = '' or coalesce(p_args->>'fieldKey', '') = ''
      or p_args->>'answer' is null then raise exception 'answer identity required'; end if;
    insert into public.form_answers(user_id, site_host, field_key, answer, kind, label, source)
    values (p_user, left(p_args->>'siteHost', 255), left(p_args->>'fieldKey', 500), left(p_args->>'answer', 10000),
      left(p_args->>'kind', 80), left(p_args->>'label', 500), 'engine')
    on conflict (user_id, site_host, field_key) do update set answer = excluded.answer,
      kind = excluded.kind, label = excluded.label, updated_at = now();
    v_result := 'null';
  when 'memory.touch' then
    update public.form_answers set reuse_count = reuse_count + 1, last_used_at = now()
      where user_id = p_user and site_host = p_args->>'siteHost'
        and field_key in (select jsonb_array_elements_text(coalesce(p_args->'fieldKeys', '[]')));
    v_result := 'null';
  when 'memory.stats' then
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select site_host, count(*) as answers, count(*) filter (where reuse_count > 0) as reused,
        coalesce(sum(reuse_count), 0) as total_reuses, max(last_used_at) as last_used
      from public.form_answers where user_id = p_user group by site_host order by total_reuses desc
    ) x;
  when 'strikes.list' then
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select skill, strikes, updated_at from public.apply_skill_strikes where user_id = p_user
        and site_host = 'global' and strikes >= coalesce((p_args->>'min')::int, 0) order by strikes desc, skill
    ) x;
  when 'strikes.clear' then
    delete from public.apply_skill_strikes where user_id = p_user and site_host = 'global'
      and skill in (select lower(btrim(jsonb_array_elements_text(coalesce(p_args->'skills', '[]')))));
    v_result := 'null';
  when 'feedback.put' then
    if p_args->>'verdict' is null or p_args->>'verdict' not in ('good','bad') then raise exception 'bad verdict'; end if;
    select feedback into v_status from public.apply_results where user_id = p_user and id = (p_args->>'id')::uuid for update;
    if not found then raise exception 'result not found'; end if;
    /* Network retries must not double-teach a strike. The first choice wins. */
    if v_status is null then
      update public.apply_results set feedback = p_args->>'verdict' where user_id = p_user and id = (p_args->>'id')::uuid;
      for v_skill in select distinct lower(btrim(value)) from jsonb_array_elements_text(coalesce(p_args->'skills', '[]')) loop
        if v_skill = '' then continue; end if;
        if p_args->>'verdict' = 'bad' then
          insert into public.apply_skill_strikes(user_id, site_host, skill, strikes) values(p_user, 'global', left(v_skill, 100), 1)
          on conflict(user_id, site_host, skill) do update set strikes = apply_skill_strikes.strikes + 1, updated_at = now();
        else delete from public.apply_skill_strikes where user_id = p_user and site_host = 'global' and skill = v_skill;
        end if;
      end loop;
    end if;
    return public.apply_core_action(p_user, 'strikes.list', '{}');
  when 'exemplars.list' then
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select id, kind, summary, reason, source_url, created_at from public.judge_exemplars
      where user_id = p_user order by created_at desc, id desc limit least(v_limit, 200)
    ) x;
  when 'exemplars.put' then
    if p_args->>'kind' is null or p_args->>'kind' not in ('positive','negative')
      or coalesce(btrim(p_args->>'summary'), '') = '' then raise exception 'valid exemplar required'; end if;
    insert into public.judge_exemplars(user_id, kind, summary, reason, source_url)
    values (p_user, p_args->>'kind', left(btrim(p_args->>'summary'), 200), left(p_args->>'reason', 300), left(p_args->>'sourceUrl', 4096))
    on conflict do nothing;
    v_result := 'null';
  when 'exemplars.delete' then
    delete from public.judge_exemplars where user_id = p_user and id = (p_args->>'id')::uuid;
    if not found then raise exception 'exemplar not found'; end if;
    v_result := 'null';
  when 'outcomes.record' then
    v_status := p_args->>'responseKind';
    if v_status is not null and v_status not in ('reply','interview','rejected','offer') then raise exception 'bad response kind'; end if;
    if coalesce(p_args->>'jobUrl', '') = '' or coalesce(p_args->>'siteHost', '') = '' then raise exception 'site and job URL required'; end if;
    insert into public.apply_outcomes(user_id, site_host, job_url, fit, fit_band, viewed_at, responded_at, response_kind, detail)
    values(p_user, left(p_args->>'siteHost', 255), left(p_args->>'jobUrl', 4096), (p_args->>'fit')::int,
      public.fit_band_of((p_args->>'fit')::int), case when (p_args->>'viewed')::boolean then now() end,
      case when v_status is not null then now() end, v_status, left(p_args->>'detail', 4000))
    on conflict(user_id, job_url) do update set viewed_at = coalesce(apply_outcomes.viewed_at, excluded.viewed_at),
      responded_at = coalesce(apply_outcomes.responded_at, excluded.responded_at),
      response_kind = coalesce(apply_outcomes.response_kind, excluded.response_kind),
      fit = coalesce(excluded.fit, apply_outcomes.fit), detail = coalesce(excluded.detail, apply_outcomes.detail), scraped_at = now();
    v_result := 'null';
  when 'outcomes.stats', 'outcomes.digest' then
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select r.site_host, public.fit_band_of(r.fit) as fit_band, count(*) as applications,
        count(o.viewed_at) as viewed, count(o.responded_at) as responded,
        count(*) filter(where o.response_kind = 'rejected') as rejected,
        count(*) filter(where o.response_kind in ('interview','offer')) as interviews,
        round(count(o.responded_at)::numeric / greatest(count(*), 1), 3) as response_rate
      from (select distinct on(job_url) * from public.apply_results where user_id = p_user and result = 'submitted'
        and created_at > now() - case when p_action = 'outcomes.stats' then interval '90 days' else interval '7 days' end
        order by job_url, created_at desc) r
      left join public.apply_outcomes o on o.user_id = r.user_id and o.job_url = r.job_url
      group by r.site_host, public.fit_band_of(r.fit) order by r.site_host, public.fit_band_of(r.fit)
    ) x;
  when 'digest.weekly' then
    select coalesce(jsonb_agg(x), '[]') into v_result from (
      select site_host, sum(submitted) as submitted, sum(needs_review) as needs_review,
        sum(skipped) as skipped, sum(errors) as errors, sum(owner_applied) as owner_applied,
        sum(owner_dismissed) as owner_dismissed, sum(owner_closed) as owner_closed
      from (
        select site_host, count(*) filter(where result = 'submitted') as submitted,
          count(*) filter(where result = 'needs_review') as needs_review,
          count(*) filter(where result = 'skipped') as skipped, count(*) filter(where result = 'error') as errors,
          0::bigint as owner_applied, 0::bigint as owner_dismissed, 0::bigint as owner_closed
        from public.apply_results where user_id = p_user and created_at > now() - interval '7 days' group by site_host
        union all
        select site_host, 0, 0, 0, 0, count(*) filter(where status = 'done'),
          count(*) filter(where status = 'dismissed'), count(*) filter(where status = 'closed')
        from public.job_apply_reviews where user_id = p_user and resolved_at > now() - interval '7 days' group by site_host
      ) totals group by site_host order by site_host
    ) x;
  when 'notify.get' then
    select to_jsonb(x) into v_result from (select chat_id, bot_token from public.user_notify_config where user_id = p_user) x;
  else raise exception 'unsupported action';
  end case;
  return coalesce(v_result, 'null'::jsonb);
end $$;
revoke all on function public.apply_core_action(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_core_action(uuid, text, jsonb) to service_role;

create or replace function public.my_apply_action(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if not p_action = any(array['results.list','reviews.list','reviews.resolved','reviews.resolve','reviews.unresolve',
    'variants.list','variants.approve','memory.stats','strikes.list','exemplars.list','exemplars.put','exemplars.delete',
    'feedback.put','digest.weekly']) then raise exception 'unsupported self-service action'; end if;
  return public.apply_core_action(auth.uid(), p_action, p_args);
end $$;
revoke all on function public.my_apply_action(text, jsonb) from public, anon;
grant execute on function public.my_apply_action(text, jsonb) to authenticated;

create or replace function public.apply_agent_action(p_user uuid, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then raise exception 'service role required'; end if;
  if not public.has_auto_apply_access(p_user) then raise exception 'auto-apply entitlement required'; end if;
  return public.apply_core_action(p_user, p_action, p_args);
end $$;
revoke all on function public.apply_agent_action(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_agent_action(uuid, text, jsonb) to service_role;

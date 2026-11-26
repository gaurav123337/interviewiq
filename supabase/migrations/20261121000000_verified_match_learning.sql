/* Verified match learning, approved 2026-11-20. Additive, manual installation
   only. Preferences never become facts, self reports never graduate autonomy,
   and the historical dispatcher retains every irreversible-attempt guard. */

begin;

alter table public.apply_tasks add column if not exists match_decision jsonb;
alter table public.apply_tasks drop constraint if exists apply_tasks_match_decision_check;
alter table public.apply_tasks add constraint apply_tasks_match_decision_check
  check (match_decision is null or jsonb_typeof(match_decision)='object');
alter table public.apply_tasks drop constraint if exists apply_tasks_status_check;
alter table public.apply_tasks add constraint apply_tasks_status_check check (status in
  ('queued','in_progress','submitting','waiting_answer','waiting_login','waiting_review','unsupported','submitted','unverified','failed','cancelled','filtered',
   'manual_actionable','waiting_match_answer','manual_applied','user_skipped'));
alter table public.apply_binding_commands drop constraint if exists apply_binding_commands_type_check;
alter table public.apply_binding_commands add constraint apply_binding_commands_type_check
  check(type in ('pause','resume','retry_login','open_question','check_session','open_manual'));
alter table public.apply_binding_commands add column if not exists profile_revision integer;
alter table public.apply_binding_commands add column if not exists settings_revision integer;

create table if not exists public.apply_match_feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null, job_url text not null, job_key text not null, similarity_key text not null, portal text not null,
  scope text not null check(scope in ('exact','similar')), verdict text not null check(verdict in ('apply','skip')),
  profile_revision integer not null check(profile_revision>0), settings_revision integer not null check(settings_revision>0),
  confirmed_at timestamptz not null default now(), revoked_at timestamptz,
  source text not null default 'user' check(source='user'),
  foreign key(task_id,user_id) references public.apply_tasks(id,user_id) on delete cascade,
  check(char_length(similarity_key) between 1 and 16000), check(char_length(portal)<=200)
);
create unique index if not exists apply_match_feedback_active_task_scope_idx on public.apply_match_feedback(user_id,task_id,scope) where revoked_at is null;
create index if not exists apply_match_feedback_scope_idx on public.apply_match_feedback(user_id,similarity_key,portal,profile_revision,settings_revision) where revoked_at is null;
create table if not exists public.apply_match_grants (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null, similarity_key text not null, portal text not null,
  profile_revision integer not null check(profile_revision>0), settings_revision integer not null check(settings_revision>0),
  granted_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz,
  source text not null default 'user' check(source='user'),
  foreign key(task_id,user_id) references public.apply_tasks(id,user_id) on delete cascade,
  check(expires_at>granted_at and expires_at<=granted_at+interval '30 days'),
  check(char_length(similarity_key) between 1 and 16000), check(char_length(portal) between 1 and 200)
);
create index if not exists apply_match_grants_scope_idx on public.apply_match_grants(user_id,similarity_key,portal,profile_revision,settings_revision) where revoked_at is null;
create table if not exists public.apply_match_questions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null, job_url text not null, similarity_key text not null, portal text not null,
  profile_revision integer not null check(profile_revision>0), settings_revision integer not null check(settings_revision>0),
  question jsonb not null check(jsonb_typeof(question)='object'), answer text not null check(answer in ('yes','no','unsure')),
  suggestion text not null check(suggestion in ('profile_update','none')), answered_at timestamptz not null default now(),
  source text not null default 'user' check(source='user'),
  foreign key(task_id,user_id) references public.apply_tasks(id,user_id) on delete cascade,
  unique(user_id,task_id,profile_revision,settings_revision)
);
create table if not exists public.apply_match_manual_receipts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null, job_url text not null, job_key text not null, similarity_key text not null, portal text not null,
  profile_revision integer not null check(profile_revision>0), settings_revision integer not null check(settings_revision>0),
  source text not null check(source in ('user','worker')), reported_at timestamptz not null default now(), observed_at timestamptz,
  command_id uuid references public.apply_binding_commands(id), binding_id uuid references public.apply_agent_bindings(id),
  account_identity text, before_snapshot jsonb, after_snapshot jsonb,
  foreign key(task_id,user_id) references public.apply_tasks(id,user_id) on delete cascade,
  unique(user_id,job_key,profile_revision,settings_revision,source), unique(command_id),
  check((source='user' and observed_at is null and command_id is null and binding_id is null and account_identity is null and before_snapshot is null and after_snapshot is null)
    or (source='worker' and observed_at is not null and command_id is not null and binding_id is not null and char_length(account_identity) between 1 and 200
      and jsonb_typeof(before_snapshot)='object' and jsonb_typeof(after_snapshot)='object'))
);

/* RPC-only, including service-role table writes: only the security-definer
   dispatcher may create provenance or graduation credit. No owner policies. */
do $$ declare t text; begin
  foreach t in array array['apply_match_feedback','apply_match_grants','apply_match_questions','apply_match_manual_receipts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  end loop;
end $$;

/* Rename exactly once; replay must not capture the wrapper as its own base. */
do $$ begin
  if to_regprocedure('public.apply_pipeline_action_pre_learning(uuid,uuid,text,jsonb)') is null then
    if to_regprocedure('public.apply_pipeline_action(uuid,uuid,text,jsonb)') is null then raise exception 'install the historical apply pipeline migration first'; end if;
    alter function public.apply_pipeline_action(uuid,uuid,text,jsonb) rename to apply_pipeline_action_pre_learning;
  end if;
end $$;
revoke all on function public.apply_pipeline_action_pre_learning(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;

/* Permit only bounded additive board metadata, preserving every historical
   job-shape guard. Replaying this migration must not capture its own wrapper. */
do $$ begin
  if to_regprocedure('public.apply_pipeline_validate_job_pre_learning(jsonb)') is null then
    alter function public.apply_pipeline_validate_job(jsonb) rename to apply_pipeline_validate_job_pre_learning;
  end if;
end $$;
create or replace function public.apply_pipeline_validate_job(p_job jsonb)
returns boolean language sql immutable set search_path=pg_catalog,public as $$
  select coalesce((not p_job ? 'boardMatch' or jsonb_typeof(p_job->'boardMatch')='string'
    and char_length(p_job->>'boardMatch')<=20 and lower(btrim(p_job->>'boardMatch')) in ('low','medium','high','unknown'))
    and public.apply_pipeline_validate_job_pre_learning(p_job-'boardMatch'),false)
$$;

create or replace function public.apply_pipeline_learning_normalize(p_value text)
returns text language sql immutable set search_path=pg_catalog,public as $$
  select lower(regexp_replace(btrim(normalize(coalesce(p_value,''),NFKC)),'\s+',' ','g'))
$$;
create or replace function public.apply_pipeline_learning_skill(p_value text)
returns text language plpgsql immutable set search_path=pg_catalog,public as $$
declare v text:=public.apply_pipeline_learning_normalize(p_value); begin
  if char_length(v)>80 or v !~ '^[a-z0-9+#. /-]+$' then return ''; end if;
  return case v when 'react.js' then 'react' when 'reactjs' then 'react' when 'node.js' then 'node' when 'nodejs' then 'node'
    when 'vue.js' then 'vue' when 'vuejs' then 'vue' when 'next.js' then 'next' when 'nextjs' then 'next'
    when 'js' then 'javascript' when 'ts' then 'typescript' when 'c sharp' then 'c#' when 'c plus plus' then 'c++'
    when 'golang' then 'go' when 'amazon web services' then 'aws' else v end;
end $$;
create or replace function public.apply_pipeline_learning_skills(p_text text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare v_token text; v_text text:=public.apply_pipeline_learning_normalize(p_text); v_result jsonb:='[]'; v_pattern text; begin
  foreach v_token in array array['html','css','javascript','typescript','react','next','node','vue','angular','python','java','c++','c#','golang','rust','ruby','php','swift','kotlin','sql','postgresql','mysql','mongodb','aws','azure','gcp','docker','kubernetes','graphql','spring','django','flask',
    'react.js','reactjs','node.js','nodejs','vue.js','vuejs','next.js','nextjs','js','ts','c sharp','c plus plus','amazon web services'] loop
    v_pattern:=regexp_replace(v_token,'([.\\+*?\[\](){}^$|])','\\\1','g');
    if v_text ~ ('(^|[^a-z0-9+#])'||v_pattern||'($|[^a-z0-9+#])') then v_result:=v_result||jsonb_build_array(public.apply_pipeline_learning_skill(v_token)); end if;
  end loop;
  return (select coalesce(jsonb_agg(s order by s collate "C"),'[]') from (select distinct x s from jsonb_array_elements_text(v_result) x) q);
end $$;
create or replace function public.apply_pipeline_learning_group(p_groups jsonb,p_skills jsonb,p_core boolean,p_evidence text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare v_key text; begin
  if jsonb_array_length(p_skills)=0 then return p_groups; end if;
  select string_agg(x,'/' order by x collate "C") into v_key from jsonb_array_elements_text(p_skills) x;
  return p_groups||jsonb_build_object(v_key,jsonb_build_object('anyOf',p_skills,'core',p_core or coalesce((p_groups->v_key->>'core')::boolean,false),'evidence',left(p_evidence,300)));
end $$;
/* Independently reconstruct grounded skill/OR/core groups rather than trusting
   worker-supplied codes=[] or omitting a required Python skill from a snapshot.
   This deliberately does not replace the existing factual matcher. */
create or replace function public.apply_pipeline_learning_requirements(p_job jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare v_groups jsonb:='{}'; v_alternatives jsonb:='[]'; v_all jsonb; v_title jsonb; v_clause text; v_core boolean;
  v_skills jsonb; v_skill text; v_found text[]; v_standalone text; v_position integer; v_tokens text:=
  'amazon web services|c plus plus|javascript|typescript|postgresql|kubernetes|react\.js|reactjs|node\.js|nodejs|vue\.js|vuejs|next\.js|nextjs|c sharp|mongodb|graphql|angular|python|golang|docker|spring|django|kotlin|mysql|azure|flask|swift|react|next|node|java|rust|ruby|php|sql|aws|gcp|vue|c\+\+|c#|html|css|js|ts';
begin
  v_title:=public.apply_pipeline_learning_skills(p_job->>'title');
  select coalesce(jsonb_agg(s order by s collate "C"),'[]') into v_all from (select distinct public.apply_pipeline_learning_skill(x) s from
    jsonb_array_elements_text(v_title||public.apply_pipeline_learning_skills(p_job->>'description')||coalesce(p_job->'skills','[]')) x where public.apply_pipeline_learning_skill(x)<>'') q;
  for v_clause in select regexp_split_to_table(coalesce(p_job->>'description',''),E'\n|[.;](?=\\s|$)|,\\s*but\\s+','i') loop
    v_core:=v_clause ~* '\m(require[ds]?|must|essential|mandatory|proficien(t|cy)|expertise|strong (knowledge|experience)|backend development|back.end development)\M'
      and v_clause !~* '\m(preferred|optional|nice.to.have|not required|not necessary|no experience)\M';
    v_standalone:=public.apply_pipeline_learning_normalize(v_clause);
    for v_found in select regexp_matches(v_standalone,
      '(?<![a-z0-9+#])(('||v_tokens||')(\s*(and\s*/\s*or|/|or)\s*('||v_tokens||'))+)(?![a-z0-9+#])','g') loop
      v_skills:=public.apply_pipeline_learning_skills(v_found[1]);
      if jsonb_array_length(v_skills)<2 then continue; end if;
      v_groups:=public.apply_pipeline_learning_group(v_groups,v_skills,v_core,v_clause); v_alternatives:=v_alternatives||v_skills;
      /* Only mask this OR expression's span. A preceding optional OR or a
         repeated skill outside the group cannot hide standalone core facts. */
      v_position:=strpos(v_standalone,v_found[1]);
      if v_position>0 then v_standalone:=overlay(v_standalone placing repeat(' ',char_length(v_found[1])) from v_position for char_length(v_found[1])); end if;
    end loop;
    if v_core then
      for v_skill in select jsonb_array_elements_text(public.apply_pipeline_learning_skills(v_standalone)) loop
        v_groups:=public.apply_pipeline_learning_group(v_groups,jsonb_build_array(v_skill),true,v_clause);
      end loop;
    end if;
  end loop;
  for v_skill in select jsonb_array_elements_text(v_title) loop v_groups:=public.apply_pipeline_learning_group(v_groups,jsonb_build_array(v_skill),true,p_job->>'title'); end loop;
  for v_skill in select jsonb_array_elements_text(v_all) loop
    if not v_alternatives ? v_skill and not v_groups ? v_skill then v_groups:=public.apply_pipeline_learning_group(v_groups,jsonb_build_array(v_skill),false,'Posting skill'); end if;
  end loop;
  return (select coalesce(jsonb_agg(value order by key collate "C"),'[]') from jsonb_each(v_groups));
end $$;
create or replace function public.apply_pipeline_learning_similarity(p_job jsonb,p_requirements jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare v_title text:=replace(public.apply_pipeline_learning_normalize(p_job->>'title'),'-',' '); v_family text; v_seniority text; v_groups jsonb; v_country text; begin
  v_family:=case when v_title ~ '\mfull\s?stack\M' then 'fullstack' when v_title ~ '\m(front\s?end|ui engineer)\M' then 'frontend'
    when v_title ~ '\mback\s?end\M' then 'backend' when v_title ~ '\m(qa|sdet|test engineer|data|machine learning|devops|sre|security)\M' then 'specialist'
    when v_title ~ '\m(engineer|developer|architect)\M' then 'software' else 'other' end;
  v_seniority:=coalesce(substring(public.apply_pipeline_learning_normalize(p_job->>'title') from '\m(intern|junior|senior|staff|principal|lead)\M'),'unspecified');
  select coalesce(jsonb_agg(s order by s collate "C"),'[]') into v_groups from (select
    case when g->>'core'='true' then 'core:' else '' end||(select string_agg(x,'/' order by x collate "C") from jsonb_array_elements_text(g->'anyOf') x) s
    from jsonb_array_elements(p_requirements) g) q;
  v_country:=public.apply_pipeline_learning_normalize(p_job->>'country');
  v_country:=case when v_country in ('india','united states','united states of america','usa','u.s.','united kingdom','uk','canada','germany','australia','singapore') or v_country ~ '^[a-z]{2}$'
    then public.apply_pipeline_country(v_country) else v_country end;
  return jsonb_build_array('verified-match-v1',v_family,v_seniority,v_groups,v_country,public.apply_pipeline_learning_normalize(p_job->>'location'),coalesce(p_job->>'remote'='true',false));
end $$;
create or replace function public.apply_pipeline_learning_decision_valid(p_task public.apply_tasks,p_profile public.apply_verified_profiles,p_settings public.apply_pipeline_settings,p_decision jsonb,p_now timestamptz)
returns boolean language plpgsql stable set search_path=pg_catalog,public as $$
declare v_group jsonb; v_requirements jsonb; v_normalized jsonb:='[]'; v_expected jsonb; v_portal text; begin
  if not public.apply_pipeline_keys(p_decision,array['status','similarityKey','portal','codes','reason','requirements','missingCore','question','eligible','score','reasons','missing','matched','ageHours','profileRevision','settingsRevision','answersRevision','source','grantId','jobUrl','decidedAt'])
    or coalesce(p_decision->>'status','') not in ('manual_actionable','waiting_match_answer','eligible_review','eligible_auto')
    or jsonb_typeof(p_decision->'similarityKey') is distinct from 'string' or char_length(p_decision->>'similarityKey') not between 1 and 16000
    or jsonb_typeof(p_decision->'portal') is distinct from 'string' or char_length(p_decision->>'portal')>200
    or not public.apply_pipeline_strings(p_decision->'codes',100,200) or not public.apply_pipeline_strings(p_decision->'missingCore',100,200)
    or jsonb_typeof(p_decision->'reason') is distinct from 'string' or char_length(p_decision->>'reason')>2000
    or jsonb_typeof(p_decision->'requirements') is distinct from 'array' or jsonb_array_length(p_decision->'requirements')>200 then return false; end if;
  if p_decision ? 'profileRevision' and (p_decision->>'profileRevision')::integer is distinct from p_profile.revision
    or p_decision ? 'settingsRevision' and (p_decision->>'settingsRevision')::integer is distinct from p_settings.revision
    or p_decision ? 'jobUrl' and p_decision->>'jobUrl' is distinct from p_task.job->>'jobUrl' then return false; end if;
  v_portal:=public.apply_pipeline_job_context(p_task.job)->>'portal';
  if p_decision->>'portal' is distinct from v_portal and not (p_decision->>'portal'='' and p_decision->>'status' in ('manual_actionable','waiting_match_answer')) then return false; end if;
  for v_group in select jsonb_array_elements(p_decision->'requirements') loop
    if not public.apply_pipeline_keys(v_group,array['anyOf','core','evidence']) or not public.apply_pipeline_strings(v_group->'anyOf',100,80)
      or jsonb_array_length(v_group->'anyOf')=0 or jsonb_typeof(v_group->'core') is distinct from 'boolean'
      or jsonb_typeof(v_group->'evidence') is distinct from 'string' or char_length(v_group->>'evidence')>300 then return false; end if;
    v_normalized:=v_normalized||jsonb_build_array(jsonb_build_object('anyOf',v_group->'anyOf','core',v_group->'core'));
  end loop;
  v_requirements:=public.apply_pipeline_learning_requirements(p_task.job);
  select coalesce(jsonb_agg(jsonb_build_object('anyOf',g->'anyOf','core',g->'core') order by (g->'anyOf')::text collate "C"),'[]') into v_expected from jsonb_array_elements(v_requirements) g;
  select coalesce(jsonb_agg(g order by (g->'anyOf')::text collate "C"),'[]') into v_normalized from jsonb_array_elements(v_normalized) g;
  if v_normalized is distinct from v_expected or (p_decision->>'similarityKey')::jsonb is distinct from public.apply_pipeline_learning_similarity(p_task.job,v_requirements) then return false; end if;
  if p_decision ? 'question' and (not public.apply_pipeline_keys(p_decision->'question',array['kind','skills','text'])
    or p_decision->'question'->>'kind' is distinct from 'skill_gap' or not public.apply_pipeline_strings(p_decision->'question'->'skills',100,200)
    or jsonb_typeof(p_decision->'question'->'text') is distinct from 'string' or char_length(p_decision->'question'->>'text') not between 1 and 2000) then return false; end if;
  return true;
exception when others then return false;
end $$;
/* Extraction is not proof that every mandatory clause was understood. Unknown
   requirements or ambiguous AND/OR precedence remain human-review candidates. */
create or replace function public.apply_pipeline_learning_requirements_readable(p_job jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare v_clause text; v_normalized text; v_remainder text; v_tokens text:=
  'amazon web services|c plus plus|javascript|typescript|postgresql|kubernetes|react\.js|reactjs|node\.js|nodejs|vue\.js|vuejs|next\.js|nextjs|c sharp|mongodb|graphql|angular|python|golang|docker|spring|django|kotlin|mysql|azure|flask|swift|react|next|node|java|rust|ruby|php|sql|aws|gcp|vue|c\+\+|c#|html|css|js|ts';
begin
  if jsonb_typeof(p_job->'description') is distinct from 'string' or char_length(p_job->>'description')>50000
    or btrim(p_job->>'description')='' or p_job->>'description' ~* '([<>]|(javascript|data):|ignore (all |previous |prior )?instructions|system prompt|execute (code|script)|\meval\s*\(|\mfunction\s*\()'
    or p_job->>'description' ~ '[[:cntrl:]]' and regexp_replace(p_job->>'description',E'[\n\r\t]','','g') ~ '[[:cntrl:]]' then return false; end if;
  for v_clause in select regexp_split_to_table(p_job->>'description',E'\n|[.;](?=\\s|$)|,\\s*but\\s+','i') loop
    if v_clause !~* '\m(require[ds]?|must|essential|mandatory|proficien(t|cy)|expertise|experience|strong (knowledge|experience)|backend development|back.end development|years?|yrs?|months?|degree|bachelor|master|doctorate|phd|diploma|certificat(e|ion)|licen[cs]e|credential|qualification)\M' then continue; end if;
    v_normalized:=regexp_replace(v_clause,'and\s*/\s*or','or','gi');
    if jsonb_array_length(public.apply_pipeline_learning_skills(v_clause))=0
      or v_clause ~* '\m(preferred|optional|nice.to.have|not required|not necessary|no experience)\M' and v_clause !~* '\m(not required|not necessary|no experience)\M'
      or (v_normalized ~* '\mor\M|/' and v_normalized ~* '\mand\M') then return false; end if;
    /* Recognizing one skill must not erase a second unverified requirement.
       Only skill vocabulary, structural fillers and punctuation are understood;
       credentials, education, years/counts and unknown skills need review. */
    v_remainder:=regexp_replace(v_clause,'(?<![a-z0-9+#])('||v_tokens||')(?![a-z0-9+#])',' ','gi');
    v_remainder:=regexp_replace(v_remainder,'\m(require[ds]?|must|essential|mandatory|proficien(t|cy)|expertise|strong|knowledge|experience|in|with|of|and|or|know|have|be|is|are|a|an|the|to|for|using|development|frontend|backend|front|back|end|application|applications|skills?|technical|programming|language|languages|not|necessary|no)\M',' ','gi');
    if regexp_replace(v_remainder,'[\s,.:;()/&-]','','g')<>'' then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;
/* Validate the complete supplied scope, never country alone. The historical
   matcher still independently vetoes scoped skills; this adds no exemption. */
create or replace function public.apply_pipeline_learning_scoped_fact(p_fact jsonb,p_job jsonb,p_now timestamptz)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare v_confirmed timestamptz; v_until timestamptz; v_context jsonb:=public.apply_pipeline_job_context(p_job); k text; v jsonb; v_actual text; v_expected text; begin
  if jsonb_typeof(p_fact) is distinct from 'object' or p_fact->>'source' is distinct from 'user' then return false; end if;
  v_confirmed:=(p_fact->>'confirmedAt')::timestamptz;
  if v_confirmed is null or not isfinite(v_confirmed) or v_confirmed>p_now then return false; end if;
  if p_fact ? 'validUntil' then
    v_until:=(p_fact->>'validUntil')::timestamptz;
    if v_until is null or not isfinite(v_until) or v_until<=p_now or v_until<=v_confirmed then return false; end if;
  end if;
  if p_fact ? 'scope' then
    if not public.apply_pipeline_keys(p_fact->'scope',array['country','employer','portal','application']) then return false; end if;
    for k,v in select * from jsonb_each(p_fact->'scope') loop
      if jsonb_typeof(v) is distinct from 'string' or char_length(v#>>'{}') not between 1 and 2000 or btrim(v#>>'{}')='' then return false; end if;
      v_expected:=case when k='country' then public.apply_pipeline_country(public.apply_pipeline_learning_normalize(v#>>'{}'))
        when k='application' then btrim(v#>>'{}') else public.apply_pipeline_learning_normalize(v#>>'{}') end;
      v_actual:=case when k='application' then v_context->>k else public.apply_pipeline_learning_normalize(v_context->>k) end;
      if k='country' then v_actual:=public.apply_pipeline_country(v_actual); end if;
      if v_expected is distinct from v_actual or v_expected='' then return false; end if;
    end loop;
  end if;
  return true;
exception when others then return false;
end $$;
create or replace function public.apply_pipeline_learning_auto_target(p_task public.apply_tasks)
returns boolean language sql stable set search_path=pg_catalog,public as $$
  select public.apply_pipeline_auto_site(p_task.job) is not null
    and exists(select 1 from public.apply_runs r where r.id=p_task.run_id and r.user_id=p_task.user_id and r.mode='auto' and r.status<>'cancelled')
$$;
create or replace function public.apply_pipeline_learning_safe(p_task public.apply_tasks,p_profile public.apply_verified_profiles,p_settings public.apply_pipeline_settings,p_now timestamptz)
returns boolean language plpgsql stable set search_path=pg_catalog,public as $$
declare v_decision jsonb:=p_task.match_decision; v_match jsonb; v_skill jsonb; v_confirmed jsonb; v_family text; begin
  if p_task.profile_revision is distinct from p_profile.revision or p_task.settings_revision is distinct from p_settings.revision
    or p_task.answers_revision is distinct from p_profile.answers_revision or not public.apply_pipeline_learning_decision_valid(p_task,p_profile,p_settings,v_decision,p_now)
    or (v_decision->>'profileRevision')::integer is distinct from p_profile.revision or (v_decision->>'settingsRevision')::integer is distinct from p_settings.revision
    or v_decision->>'jobUrl' is distinct from p_task.job->>'jobUrl' or coalesce(v_decision->>'status','') not in ('eligible_review','eligible_auto')
    or v_decision->'codes' is distinct from '[]'::jsonb or v_decision->'missingCore' is distinct from '[]'::jsonb
    or not public.apply_pipeline_validate_job(p_task.job) or not public.apply_pipeline_learning_requirements_readable(p_task.job)
    or p_task.job ? 'boardMatch' and public.apply_pipeline_learning_normalize(p_task.job->>'boardMatch')='low'
    or (p_task.job->>'postedAt')::timestamptz>p_now then return false; end if;
  /* Base factual matching is additive, never waived by feedback or a grant. */
  v_match:=public.apply_pipeline_match(p_profile.facts,p_settings.data,p_task.job,p_now);
  if v_match->>'reason' is not null then return false; end if;
  /* The historical legal-fact gate checks country. If the user supplied a
     narrower employer/portal/application scope, every key must also match. */
  if p_settings.data->>'requireWorkAuthorization'='true' and not public.apply_pipeline_learning_scoped_fact(p_profile.facts->'workAuthorization',p_task.job,p_now)
    or p_settings.data->>'allowSponsorship'='false' and not public.apply_pipeline_learning_scoped_fact(p_profile.facts->'requiresSponsorship',p_task.job,p_now) then return false; end if;
  v_skill:=p_profile.facts->'skills';
  if not public.apply_pipeline_learning_scoped_fact(v_skill,p_task.job,p_now) or not public.apply_pipeline_strings(v_skill->'value',100,200) then return false; end if;
  select coalesce(jsonb_agg(public.apply_pipeline_learning_skill(f)),'[]') into v_confirmed from jsonb_array_elements_text(v_skill->'value') f;
  v_family:=public.apply_pipeline_learning_similarity(p_task.job,v_decision->'requirements')->>1;
  if v_family in ('frontend','fullstack') and not v_confirmed ?| array['react','typescript','javascript','vue','angular','next','html','css']
    or v_family in ('backend','fullstack') and not v_confirmed ?| array['node','python','java','c#','go','rust','ruby','php','kotlin','spring','django','flask'] then return false; end if;
  /* Every extracted requirement, including optional gaps, must have explicit
     skills before auto/review eligibility. OR groups need one fact, not all. */
  if jsonb_array_length(v_decision->'requirements')=0 or exists(select 1 from jsonb_array_elements(v_decision->'requirements') g
    where not exists(select 1 from jsonb_array_elements_text(g->'anyOf') s join jsonb_array_elements_text(v_skill->'value') f on public.apply_pipeline_learning_skill(f)=s)) then return false; end if;
  if exists(select 1 from public.apply_match_feedback f where f.user_id=p_task.user_id and f.source='user' and f.revoked_at is null and f.verdict='skip'
    and f.confirmed_at<=p_now and f.profile_revision=p_profile.revision and f.settings_revision=p_settings.revision
    and (f.scope='exact' and f.job_key=p_task.job_key or f.scope='similar' and f.similarity_key=v_decision->>'similarityKey' and f.portal=v_decision->>'portal')) then return false; end if;
  return true;
exception when others then return false;
end $$;

/* A close-match question is still pending work. Manual-actionable rows remain
   handoffs, matching the historical filtered-job completion behavior. */
create or replace function public.apply_pipeline_refresh_run(p_run uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  update public.apply_runs set status='completed',finished_at=coalesce(finished_at,clock_timestamp()) where id=p_run and status<>'cancelled'
    and not exists(select 1 from public.apply_tasks where run_id=p_run and status in
      ('queued','in_progress','submitting','waiting_answer','waiting_login','waiting_review','waiting_match_answer'));
end $$;

/* Explicit server JSON builders avoid leaking owners, command nonces or raw
   browser evidence, and keep JS provenance/revision/timestamps camel-cased. */
create or replace function public.apply_pipeline_learning_feedback_json(p_row public.apply_match_feedback)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$ select jsonb_build_object('id',p_row.id,'taskId',p_row.task_id,'jobUrl',p_row.job_url,'similarityKey',p_row.similarity_key,'portal',p_row.portal,'scope',p_row.scope,'verdict',p_row.verdict,'profileRevision',p_row.profile_revision,'settingsRevision',p_row.settings_revision,'confirmedAt',p_row.confirmed_at,'revokedAt',p_row.revoked_at,'source',p_row.source) $$;
create or replace function public.apply_pipeline_learning_grant_json(p_row public.apply_match_grants)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$ select jsonb_build_object('id',p_row.id,'taskId',p_row.task_id,'similarityKey',p_row.similarity_key,'portal',p_row.portal,'profileRevision',p_row.profile_revision,'settingsRevision',p_row.settings_revision,'grantedAt',p_row.granted_at,'expiresAt',p_row.expires_at,'revokedAt',p_row.revoked_at,'source',p_row.source) $$;
create or replace function public.apply_pipeline_learning_receipt_json(p_row public.apply_match_manual_receipts)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$ select jsonb_build_object('id',p_row.id,'taskId',p_row.task_id,'jobUrl',p_row.job_url,'similarityKey',p_row.similarity_key,'portal',p_row.portal,'profileRevision',p_row.profile_revision,'settingsRevision',p_row.settings_revision,'reportedAt',p_row.reported_at,'observedAt',p_row.observed_at,'source',p_row.source,'commandId',p_row.command_id,'accountIdentity',p_row.account_identity) $$;
create or replace function public.apply_pipeline_learning_question_json(p_row public.apply_match_questions)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$ select jsonb_build_object('id',p_row.id,'taskId',p_row.task_id,'jobUrl',p_row.job_url,'similarityKey',p_row.similarity_key,'portal',p_row.portal,'profileRevision',p_row.profile_revision,'settingsRevision',p_row.settings_revision,'question',p_row.question,'answer',p_row.answer,'suggestion',p_row.suggestion,'answeredAt',p_row.answered_at,'source',p_row.source) $$;

create or replace function public.apply_pipeline_learning_eligibility(p_task public.apply_tasks,p_profile public.apply_verified_profiles,p_settings public.apply_pipeline_settings,p_now timestamptz)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_applies integer; v_receipts integer; v_safe boolean; begin
  select count(distinct f.job_key) into v_applies from public.apply_match_feedback f where f.user_id=p_task.user_id and f.scope='similar' and f.verdict='apply'
    and f.source='user' and f.revoked_at is null and f.confirmed_at<=p_now and f.profile_revision=p_profile.revision and f.settings_revision=p_settings.revision
    and f.similarity_key=p_task.match_decision->>'similarityKey' and f.portal=p_task.match_decision->>'portal';
  select count(distinct r.job_key) into v_receipts from public.apply_match_manual_receipts r join public.apply_binding_commands c on c.id=r.command_id
    where r.user_id=p_task.user_id and r.source='worker' and r.observed_at is not null and r.observed_at<=p_now
    and r.profile_revision=p_profile.revision and r.settings_revision=p_settings.revision and r.similarity_key=p_task.match_decision->>'similarityKey'
    and r.portal=p_task.match_decision->>'portal' and c.type='open_manual' and c.user_id=r.user_id and c.task_id=r.task_id and c.binding_id=r.binding_id;
  v_safe:=public.apply_pipeline_learning_safe(p_task,p_profile,p_settings,p_now) and public.apply_pipeline_learning_auto_target(p_task)
    and p_settings.data->>'enabled'='true' and p_settings.data->>'autoSubmit'='true' and p_profile.resume_approved
    and p_task.status in ('waiting_review','queued','in_progress')
    and exists(select 1 from public.apply_runs r where r.id=p_task.run_id and r.user_id=p_task.user_id and r.status<>'cancelled')
    and not exists(select 1 from public.apply_submission_reservations r where r.task_id=p_task.id)
    and exists(select 1 from public.apply_agent_bindings b where b.id=p_task.target_binding_id and b.user_id=p_task.user_id and b.revoked_at is null);
  return jsonb_build_object('taskId',p_task.id,'eligible',v_safe and v_applies>=3 and v_receipts>=2,'applySimilarCount',v_applies,'observedManualReceiptCount',v_receipts,
    'profileRevision',p_profile.revision,'settingsRevision',p_settings.revision,'similarityKey',p_task.match_decision->>'similarityKey','portal',p_task.match_decision->>'portal');
end $$;
/* Fence pending scope only. Any reservation, even failed/unverified, remains
   irreversible: never weaken finish nonces or permit a replay after learning. */
create or replace function public.apply_pipeline_learning_fence(p_user uuid,p_similarity text,p_portal text,p_job_key text,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$ begin
  update public.apply_tasks t set status=case when status='user_skipped' then 'user_skipped' else 'waiting_review' end,reason=p_reason,
    lease_version=lease_version+1,lease_until=null,lease_nonce=null,claimed_by=null,updated_at=clock_timestamp()
    where t.user_id=p_user and t.status in ('queued','in_progress','waiting_review','waiting_answer','waiting_login','manual_actionable','waiting_match_answer','user_skipped')
    and (p_job_key is not null and t.job_key=p_job_key or p_job_key is null and t.match_decision->>'similarityKey'=p_similarity and t.match_decision->>'portal'=p_portal)
    and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id);
  update public.apply_binding_commands c set status='cancelled',reason=p_reason,finished_at=clock_timestamp()
    where c.user_id=p_user and c.type='open_manual' and c.status in ('queued','claimed') and exists(select 1 from public.apply_tasks t where t.id=c.task_id and t.user_id=p_user
      and (p_job_key is not null and t.job_key=p_job_key or p_job_key is null and t.match_decision->>'similarityKey'=p_similarity and t.match_decision->>'portal'=p_portal));
end $$;

create or replace function public.apply_pipeline_learning_positive_receipt(p_text text)
returns boolean language sql immutable set search_path=pg_catalog,public as $$ select coalesce(char_length(p_text) between 1 and 2000
  and p_text !~* '(not (been )?(submitted|received|sent)|failed|error|unsuccessful|unable|not detected|already|previously)'
  and btrim(p_text) ~* '^(thank you( for (applying|your application))?[.!]?\s*)?(your |the )?application (has been |was )?(successfully )?(received|submitted|sent)[.!]?$|^thank you for (applying|your application)[.!]?$',false) $$;
create or replace function public.apply_pipeline_learning_observation_valid(p_task public.apply_tasks,p_command public.apply_binding_commands,p_before jsonb,p_after jsonb,p_now timestamptz)
returns boolean language plpgsql stable set search_path=pg_catalog,public as $$
declare v_snapshot jsonb; v_pre timestamptz; v_post timestamptz; v_session timestamptz; v_selector text; begin
  /* Only independent, exact-job session probes, nonempty unchanged identity,
     and a new known-selector receipt qualify. A preexisting receipt never does. */
  foreach v_snapshot in array array[p_before,p_after] loop
    if not public.apply_pipeline_keys(v_snapshot,array['jobUrl','checkedAt','accountIdentity','session','receipt'])
      or v_snapshot->>'jobUrl' is distinct from p_task.job->>'jobUrl'
      or jsonb_typeof(v_snapshot->'accountIdentity') is distinct from 'string' or char_length(btrim(v_snapshot->>'accountIdentity')) not between 1 and 200
      or not public.apply_pipeline_keys(v_snapshot->'session',array['ok','jobUrl','checkedAt']) or v_snapshot->'session'->'ok' is distinct from 'true'::jsonb
      or v_snapshot->'session'->>'jobUrl' is distinct from p_task.job->>'jobUrl' then return false; end if;
    v_session:=(v_snapshot->'session'->>'checkedAt')::timestamptz;
    if v_session is null or v_session>p_now or v_session<p_now-interval '5 minutes' then return false; end if;
  end loop;
  v_pre:=(p_before->>'checkedAt')::timestamptz; v_post:=(p_after->>'checkedAt')::timestamptz;
  if v_pre is null or v_post is null or v_pre<p_command.claimed_at or v_pre>=v_post or v_post>p_now or v_pre<p_now-interval '5 minutes'
    or (p_before->'session'->>'checkedAt')::timestamptz>v_pre or (p_after->'session'->>'checkedAt')::timestamptz<v_pre
    or (p_after->'session'->>'checkedAt')::timestamptz>v_post or p_before->>'accountIdentity' is distinct from p_after->>'accountIdentity'
    or p_before->'receipt' is distinct from 'null'::jsonb then return false; end if;
  v_selector:=case public.apply_pipeline_auto_site(p_task.job) when 'greenhouse' then '#application_confirmation' when 'ashby' then '[data-testid="application-success"]'
    when 'naukri' then '[role="status"]' when 'instahyre' then '[role="status"]' else null end;
  if v_selector is null or not public.apply_pipeline_keys(p_after->'receipt',array['selector','text','url'])
    or p_after->'receipt'->>'selector' is distinct from v_selector or not public.apply_pipeline_learning_positive_receipt(p_after->'receipt'->>'text')
    or not public.apply_pipeline_receipt_url(p_task.job->>'jobUrl',p_after->'receipt'->>'url') then return false; end if;
  if not exists(select 1 from public.apply_binding_sessions s where s.user_id=p_task.user_id and s.binding_id=p_command.binding_id
    and s.portal in (public.apply_pipeline_job_context(p_task.job)->>'portal',public.apply_pipeline_host(p_task.job->>'jobUrl'))
    and s.status='authenticated' and s.account_label=p_after->>'accountIdentity' and s.checked_at<=p_now and s.checked_at>p_now-interval '30 minutes') then return false; end if;
  return true;
exception when others then return false;
end $$;

create or replace function public.apply_pipeline_learning_compact(p_value jsonb)
returns text language plpgsql immutable set search_path=pg_catalog,public as $$ begin
  if jsonb_typeof(p_value)='array' then return '['||(select coalesce(string_agg(public.apply_pipeline_learning_compact(x),',' order by n),'') from jsonb_array_elements(p_value) with ordinality a(x,n))||']'; end if;
  return p_value::text;
end $$;
/* Filtered rows were never leased by the historical dispatcher. Seed only a
   grounded manual snapshot so feedback/manual opening is possible without
   queueing a rejected job for an old worker or giving it automation authority. */
create or replace function public.apply_pipeline_learning_seed_manual(p_user uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_profile public.apply_verified_profiles%rowtype; v_settings public.apply_pipeline_settings%rowtype; v_task public.apply_tasks%rowtype;
  v_requirements jsonb; v_missing jsonb; v_now timestamptz:=clock_timestamp(); begin
  select * into v_profile from public.apply_verified_profiles where user_id=p_user;
  select * into v_settings from public.apply_pipeline_settings where user_id=p_user;
  for v_task in select * from public.apply_tasks t where t.user_id=p_user and t.status in ('filtered','manual_actionable') and t.match_decision is null
    and t.profile_revision=v_profile.revision and t.settings_revision=v_settings.revision and public.apply_pipeline_validate_job(t.job)
    and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id) loop
    v_requirements:=public.apply_pipeline_learning_requirements(v_task.job);
    select coalesce(jsonb_agg(s order by s collate "C"),'[]') into v_missing from (select
      (select string_agg(x,'/' order by x collate "C") from jsonb_array_elements_text(g->'anyOf') x) s
      from jsonb_array_elements(v_requirements) g where g->>'core'='true' and not exists(select 1 from jsonb_array_elements_text(g->'anyOf') x
        join jsonb_array_elements_text(case when public.apply_pipeline_strings(v_profile.facts->'skills'->'value',100,200) and public.apply_pipeline_confirmed_fact(v_profile.facts->'skills',v_now)
          then v_profile.facts->'skills'->'value' else '[]'::jsonb end) f on public.apply_pipeline_learning_skill(f)=x)) q;
    update public.apply_tasks set status='manual_actionable',match_decision=jsonb_build_object('status','manual_actionable','eligible',false,'score',v_task.score,
      'similarityKey',public.apply_pipeline_learning_compact(public.apply_pipeline_learning_similarity(v_task.job,v_requirements)),
      'portal',public.apply_pipeline_job_context(v_task.job)->>'portal','codes',jsonb_build_array('server_match_veto'),
      'reason',coalesce(left(v_task.reason,2000),'Server match requires manual review'),'requirements',v_requirements,'missingCore',v_missing,
      'profileRevision',v_profile.revision,'settingsRevision',v_settings.revision,'answersRevision',v_profile.answers_revision,'jobUrl',v_task.job->>'jobUrl','decidedAt',v_now),
      lease_version=lease_version+1,lease_nonce=null,lease_until=null,claimed_by=null,updated_at=v_now where id=v_task.id;
  end loop;
end $$;

/* Shared wrappers already resolve authenticated owner/locked token binding.
   Keep binding-before-owner order, including user-selected open_manual, then
   serialize learning with the same owner lock used by all old reservations. */
create or replace function public.apply_pipeline_action(p_user uuid,p_binding uuid,p_action text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_profile public.apply_verified_profiles%rowtype; v_settings public.apply_pipeline_settings%rowtype; v_task public.apply_tasks%rowtype;
  v_binding public.apply_agent_bindings%rowtype; v_feedback public.apply_match_feedback%rowtype; v_grant public.apply_match_grants%rowtype;
  v_question public.apply_match_questions%rowtype; v_receipt public.apply_match_manual_receipts%rowtype; v_command public.apply_binding_commands%rowtype;
  v_now timestamptz; v_args jsonb; v_allowed text[]; v_result jsonb; v_decision jsonb; v_eligibility jsonb; v_expiry timestamptz;
  v_feedbacks jsonb; v_grants jsonb; v_receipts jsonb; v_questions jsonb; v_eligible jsonb; v_limit integer:=20; v_key text; v_portal text; v_scope text; v_old boolean;
  v_page_limit integer:=200; v_offset integer:=0; v_more boolean:=false; v_run_id uuid;
begin
  /* Old actions are untouched except additive hooks below. */
  if p_action='tasks.list' and p_binding is null then
    if p_user is null or not exists(select 1 from auth.users where id=p_user) then raise exception 'forbidden' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_user::text,6111404));
    perform public.apply_pipeline_learning_seed_manual(p_user);
    return public.apply_pipeline_action_pre_learning(p_user,p_binding,p_action,p_args);
  end if;
  if p_action not in ('learning.list','learning.feedback','learning.revoke','learning.question','learning.grant','learning.manual_report','learning.manual_observe','tasks.decide','submission.reserve','commands.claim','commands.request','profile.confirm','settings.put','run.cancel','run.request') then
    return public.apply_pipeline_action_pre_learning(p_user,p_binding,p_action,p_args);
  end if;
  if p_user is null or not exists(select 1 from auth.users where id=p_user) then raise exception 'forbidden' using errcode='42501'; end if;
  if jsonb_typeof(p_args) is distinct from 'object' or octet_length(p_args::text)>262144 or public.apply_pipeline_forbidden_keys(p_args) then raise exception 'invalid args' using errcode='22023'; end if;
  if p_action in ('profile.confirm','settings.put','run.request','run.cancel') or p_action='commands.request' and p_args->>'type' is distinct from 'open_manual' then
    v_result:=public.apply_pipeline_action_pre_learning(p_user,p_binding,p_action,p_args);
    /* This base call holds the identical owner lock. Revisions revoke all old
       applicability; include new manual statuses that the old helper predates. */
    if p_action in ('profile.confirm','settings.put') then
      v_now:=clock_timestamp();
      update public.apply_match_feedback set revoked_at=coalesce(revoked_at,v_now) where user_id=p_user and revoked_at is null;
      update public.apply_match_grants set revoked_at=coalesce(revoked_at,v_now) where user_id=p_user and revoked_at is null;
      update public.apply_tasks t set status='waiting_review',reason='revision_changed',lease_version=lease_version+1,lease_until=null,lease_nonce=null,claimed_by=null,updated_at=v_now
        where t.user_id=p_user and t.status in ('manual_actionable','waiting_match_answer') and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id);
      update public.apply_binding_commands set status='cancelled',reason='revision_changed',finished_at=v_now where user_id=p_user and type='open_manual' and status in ('queued','claimed');
    elsif p_action='run.cancel' then
      update public.apply_tasks t set status='cancelled',reason='run_cancelled',lease_version=lease_version+1,lease_until=null,lease_nonce=null,claimed_by=null,updated_at=clock_timestamp()
        where t.user_id=p_user and t.run_id=(p_args->>'runId')::uuid and t.status in ('manual_actionable','waiting_match_answer') and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id);
    elsif p_action='run.request' then
      /* Excluded jobs remain visible/manual, never queued to an old worker.
         Fresh task snapshots must not retain a previous posting's decision. */
      update public.apply_tasks set status=case when status='filtered' then 'manual_actionable' else status end,match_decision=null
        where user_id=p_user and run_id=(v_result->'run'->>'id')::uuid and status in ('filtered','queued');
      perform public.apply_pipeline_learning_seed_manual(p_user);
    end if;
    return v_result;
  end if;
  if p_binding is null then
    if p_action not in ('learning.list','learning.feedback','learning.revoke','learning.question','learning.grant','learning.manual_report','commands.request') then raise exception 'unsupported action' using errcode='22023'; end if;
  elsif p_action not in ('learning.list','learning.manual_observe','tasks.decide','submission.reserve','commands.claim') then raise exception 'unsupported action' using errcode='22023'; end if;
  v_allowed:=case p_action when 'learning.list' then array['limit','offset'] when 'learning.feedback' then array['taskId','scope','verdict','profileRevision','settingsRevision','confirm']
    when 'learning.revoke' then array['feedbackId','grantId'] when 'learning.question' then array['taskId','answer','profileRevision','settingsRevision','confirm']
    when 'learning.grant' then array['taskId','profileRevision','settingsRevision','expiresAt','confirm'] when 'learning.manual_report' then array['taskId','profileRevision','settingsRevision','confirm']
    when 'learning.manual_observe' then array['commandId','claimNonce','before','after'] when 'tasks.decide' then array['taskId','leaseVersion','leaseNonce','decision']
    when 'submission.reserve' then array['taskId','leaseVersion','leaseNonce','profileRevision','settingsRevision','answersRevision','siteAllowed','accountVerified','requiredComplete','answerIds','idempotencyKey','grantId','similarityKey']
    when 'commands.request' then array['bindingId','type','args'] when 'commands.claim' then array['limit'] end;
  if not public.apply_pipeline_keys(p_args,v_allowed) then raise exception 'invalid args' using errcode='22023'; end if;
  if p_binding is not null then
    select * into v_binding from public.apply_agent_bindings where id=p_binding and user_id=p_user and revoked_at is null for update;
    if not found then raise exception 'invalid or revoked binding' using errcode='42501'; end if;
  elsif p_action='commands.request' then
    select * into v_binding from public.apply_agent_bindings where id=(p_args->>'bindingId')::uuid and user_id=p_user and revoked_at is null for update;
    if not found then raise exception 'binding not found' using errcode='P0002'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,6111404));
  v_now:=clock_timestamp();
  if not public.service_apply_agent_has_access(p_user) and not (p_binding is null and p_action in ('learning.list','learning.revoke')) then raise exception 'not entitled' using errcode='42501'; end if;
  select * into v_profile from public.apply_verified_profiles where user_id=p_user for update;
  select * into v_settings from public.apply_pipeline_settings where user_id=p_user for update;
  perform public.apply_pipeline_learning_seed_manual(p_user);

  if p_action='learning.list' then
    if p_args ? 'limit' then
      if jsonb_typeof(p_args->'limit') is distinct from 'number' or coalesce(p_args->>'limit','') !~ '^[0-9]+$'
        or (p_args->>'limit')::numeric not between 1 and 200 then raise exception 'invalid learning limit' using errcode='22023'; end if;
      v_page_limit:=(p_args->>'limit')::integer;
    end if;
    if p_args ? 'offset' then
      if jsonb_typeof(p_args->'offset') is distinct from 'number' or coalesce(p_args->>'offset','') !~ '^[0-9]+$'
        or (p_args->>'offset')::numeric not between 0 and 2147483647 then raise exception 'invalid learning offset' using errcode='22023'; end if;
      v_offset:=(p_args->>'offset')::integer;
    end if;
    /* Page each collection independently with deterministic timestamp/id order.
       The extra row signals continuation; no read pagination applies to the
       independent active-skip, grant or graduation queries used for safety. */
    select coalesce(jsonb_agg(public.apply_pipeline_learning_feedback_json(f) order by f.confirmed_at desc,f.id),'[]') into v_feedbacks
      from (select * from public.apply_match_feedback where user_id=p_user order by confirmed_at desc,id limit v_page_limit+1 offset v_offset) f;
    select coalesce(jsonb_agg(public.apply_pipeline_learning_grant_json(g) order by g.granted_at desc,g.id),'[]') into v_grants
      from (select * from public.apply_match_grants where user_id=p_user order by granted_at desc,id limit v_page_limit+1 offset v_offset) g;
    select coalesce(jsonb_agg(public.apply_pipeline_learning_receipt_json(r) order by r.reported_at desc,r.id),'[]') into v_receipts
      from (select * from public.apply_match_manual_receipts where user_id=p_user order by reported_at desc,id limit v_page_limit+1 offset v_offset) r;
    select coalesce(jsonb_agg(public.apply_pipeline_learning_question_json(q) order by q.answered_at desc,q.id),'[]') into v_questions
      from (select * from public.apply_match_questions where user_id=p_user order by answered_at desc,id limit v_page_limit+1 offset v_offset) q;
    select coalesce(jsonb_agg(public.apply_pipeline_learning_eligibility(t,v_profile,v_settings,v_now) order by t.created_at,t.id),'[]') into v_eligible
      from (select * from public.apply_tasks where user_id=p_user and match_decision is not null and profile_revision=v_profile.revision and settings_revision=v_settings.revision
        order by created_at,id limit v_page_limit+1 offset v_offset) t;
    v_more:=jsonb_array_length(v_feedbacks)>v_page_limit or jsonb_array_length(v_grants)>v_page_limit or jsonb_array_length(v_receipts)>v_page_limit
      or jsonb_array_length(v_questions)>v_page_limit or jsonb_array_length(v_eligible)>v_page_limit;
    if jsonb_array_length(v_feedbacks)>v_page_limit then v_feedbacks:=v_feedbacks-v_page_limit; end if;
    if jsonb_array_length(v_grants)>v_page_limit then v_grants:=v_grants-v_page_limit; end if;
    if jsonb_array_length(v_receipts)>v_page_limit then v_receipts:=v_receipts-v_page_limit; end if;
    if jsonb_array_length(v_questions)>v_page_limit then v_questions:=v_questions-v_page_limit; end if;
    if jsonb_array_length(v_eligible)>v_page_limit then v_eligible:=v_eligible-v_page_limit; end if;
    return jsonb_build_object('hasMore',v_more,'learning',jsonb_build_object('feedback',v_feedbacks,'grants',v_grants,'receipts',v_receipts,'questions',v_questions,'eligibility',v_eligible));
  end if;
  if p_action='learning.revoke' then
    if (p_args ? 'feedbackId')=(p_args ? 'grantId') then raise exception 'revoke exactly one learning row' using errcode='22023'; end if;
    if p_args ? 'feedbackId' then
      update public.apply_match_feedback set revoked_at=coalesce(revoked_at,v_now) where id=(p_args->>'feedbackId')::uuid and user_id=p_user returning * into v_feedback;
      if not found then raise exception 'feedback not found' using errcode='P0002'; end if;
      v_key:=v_feedback.similarity_key; v_portal:=v_feedback.portal;
      /* Losing graduation evidence invalidates the scope's autonomy too. */
      update public.apply_match_grants set revoked_at=coalesce(revoked_at,v_now) where user_id=p_user and similarity_key=v_key and portal=v_portal and revoked_at is null;
      perform public.apply_pipeline_learning_fence(p_user,v_key,v_portal,null,'feedback_revoked');
      return jsonb_build_object('ok',true,'feedback',public.apply_pipeline_learning_feedback_json(v_feedback));
    else
      update public.apply_match_grants set revoked_at=coalesce(revoked_at,v_now) where id=(p_args->>'grantId')::uuid and user_id=p_user returning * into v_grant;
      if not found then raise exception 'grant not found' using errcode='P0002'; end if;
      perform public.apply_pipeline_learning_fence(p_user,v_grant.similarity_key,v_grant.portal,null,'grant_revoked');
      return jsonb_build_object('ok',true,'grant',public.apply_pipeline_learning_grant_json(v_grant));
    end if;
  end if;
  if p_action='commands.claim' then
    /* Never reclaim an open_manual command: replaying a human action is unsafe.
       Other commands keep their historical claim/reclaim semantics verbatim. */
    if p_args ? 'limit' then
      if coalesce(p_args->>'limit','') !~ '^[0-9]+$' or (p_args->>'limit')::numeric not between 1 and 200 then raise exception 'invalid limit' using errcode='22023'; end if;
      v_limit:=least((p_args->>'limit')::integer,20);
    end if;
    update public.apply_binding_commands set status='failed',reason='manual_command_expired',finished_at=v_now
      where user_id=p_user and binding_id=p_binding and type='open_manual' and status='claimed' and (claimed_at is null or claimed_at<=v_now-interval '5 minutes');
    /* Base would claim unknown commands without a job. Hide manual rows during
       the base claim under the owner lock, then restore/claim them below. */
    with hidden as (update public.apply_binding_commands set status='cancelled' where user_id=p_user and binding_id=p_binding and type='open_manual' and status='queued' returning id)
      select coalesce(jsonb_agg(id),'[]') into v_args from hidden;
    v_result:=public.apply_pipeline_action_pre_learning(p_user,p_binding,p_action,p_args);
    update public.apply_binding_commands set status='queued' where id in (select x::uuid from jsonb_array_elements_text(v_args) x);
    v_result:=coalesce(v_result->'commands','[]');
    for v_command in select * from public.apply_binding_commands where user_id=p_user and binding_id=p_binding and type='open_manual' and status='queued'
      order by created_at,id for update skip locked limit greatest(0,v_limit-jsonb_array_length(v_result)) loop
      select * into v_task from public.apply_tasks t where t.id=v_command.task_id and t.user_id=p_user and t.target_binding_id=p_binding
        and t.status in ('manual_actionable','waiting_match_answer','waiting_review','user_skipped') and t.profile_revision=v_profile.revision and t.settings_revision=v_settings.revision
        and v_command.profile_revision=v_profile.revision and v_command.settings_revision=v_settings.revision and public.apply_pipeline_validate_job(t.job)
        and exists(select 1 from public.apply_runs r where r.id=t.run_id and r.user_id=p_user and r.status<>'cancelled')
        and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id);
      if not found then update public.apply_binding_commands set status='failed',reason='manual_target_unavailable',finished_at=v_now where id=v_command.id; continue; end if;
      update public.apply_binding_commands set status='claimed',claimed_at=clock_timestamp(),claim_nonce=gen_random_uuid() where id=v_command.id returning * into v_command;
      v_result:=v_result||jsonb_build_array(to_jsonb(v_command)-'user_id'||jsonb_build_object('job',v_task.job));
    end loop;
    return jsonb_build_object('commands',v_result);
  end if;
  if p_action='commands.request' then
    if p_args->>'type' is distinct from 'open_manual' or not public.apply_pipeline_keys(p_args->'args',array['taskId']) then raise exception 'invalid manual command' using errcode='22023'; end if;
    select * into v_task from public.apply_tasks t where t.id=(p_args->'args'->>'taskId')::uuid and t.user_id=p_user and t.target_binding_id=v_binding.id
      and t.status in ('manual_actionable','waiting_match_answer','waiting_review','user_skipped') and t.profile_revision=v_profile.revision and t.settings_revision=v_settings.revision
      and public.apply_pipeline_validate_job(t.job) and exists(select 1 from public.apply_runs r where r.id=t.run_id and r.user_id=p_user and r.status<>'cancelled')
      and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id) for update;
    if not found then raise exception 'manual target not found' using errcode='P0002'; end if;
    if exists(select 1 from public.apply_binding_commands where user_id=p_user and task_id=v_task.id and type='open_manual' and status in ('queued','claimed')) then raise exception 'manual command already pending' using errcode='40001'; end if;
    insert into public.apply_binding_commands(binding_id,user_id,type,args,task_id,profile_revision,settings_revision)
      values(v_binding.id,p_user,'open_manual',jsonb_build_object('taskId',v_task.id),v_task.id,v_profile.revision,v_settings.revision) returning * into v_command;
    return jsonb_build_object('command',to_jsonb(v_command)-'user_id'||jsonb_build_object('job',v_task.job));
  end if;
  if p_action='learning.manual_observe' then
    select * into v_command from public.apply_binding_commands where id=(p_args->>'commandId')::uuid and user_id=p_user and binding_id=p_binding
      and type='open_manual' and status='claimed' and claim_nonce=(p_args->>'claimNonce')::uuid and claimed_at>v_now-interval '5 minutes'
      and profile_revision=v_profile.revision and settings_revision=v_settings.revision for update;
    if not found then raise exception 'current manual command required' using errcode='40001'; end if;
    select * into v_task from public.apply_tasks t where t.id=v_command.task_id and t.user_id=p_user and t.target_binding_id=p_binding
      and t.status in ('manual_actionable','waiting_match_answer','waiting_review','user_skipped','manual_applied') for update;
    if not found or v_task.profile_revision is distinct from v_profile.revision or v_task.settings_revision is distinct from v_settings.revision
      or v_task.match_decision is null or not public.apply_pipeline_learning_decision_valid(v_task,v_profile,v_settings,v_task.match_decision,v_now)
      or exists(select 1 from public.apply_submission_reservations r where r.task_id=v_task.id)
      or exists(select 1 from public.apply_match_manual_receipts r where r.command_id=v_command.id or
        r.user_id=p_user and r.job_key=v_task.job_key and r.profile_revision=v_profile.revision and r.settings_revision=v_settings.revision and r.source='worker')
      or not exists(select 1 from public.apply_runs r where r.id=v_task.run_id and r.user_id=p_user and r.status<>'cancelled')
      or not public.apply_pipeline_learning_observation_valid(v_task,v_command,p_args->'before',p_args->'after',v_now) then raise exception 'new bound manual receipt required' using errcode='22023'; end if;
    insert into public.apply_match_manual_receipts(user_id,task_id,job_url,job_key,similarity_key,portal,profile_revision,settings_revision,source,reported_at,observed_at,command_id,binding_id,account_identity,before_snapshot,after_snapshot)
      values(p_user,v_task.id,v_task.job->>'jobUrl',v_task.job_key,v_task.match_decision->>'similarityKey',v_task.match_decision->>'portal',v_profile.revision,v_settings.revision,'worker',v_now,
        (p_args->'after'->>'checkedAt')::timestamptz,v_command.id,p_binding,p_args->'after'->>'accountIdentity',p_args->'before',p_args->'after') returning * into v_receipt;
    update public.apply_tasks set status='manual_applied',reason='worker_observed_manual_receipt',lease_version=lease_version+1,lease_until=null,lease_nonce=null,claimed_by=null,updated_at=v_now where id=v_task.id;
    perform public.apply_pipeline_refresh_run(v_task.run_id);
    return jsonb_build_object('ok',true,'receipt',public.apply_pipeline_learning_receipt_json(v_receipt));
  end if;

  select * into v_task from public.apply_tasks where id=(p_args->>'taskId')::uuid and user_id=p_user for update;
  if not found then raise exception 'task not found' using errcode='P0002'; end if;
  if p_action in ('tasks.decide','submission.reserve') then
    if v_task.target_binding_id is distinct from p_binding or v_task.claimed_by is distinct from p_binding then raise exception 'task not found' using errcode='P0002'; end if;
    if v_task.status<>'in_progress' or v_task.lease_nonce is null or v_task.lease_nonce is distinct from (p_args->>'leaseNonce')::uuid
      or v_task.lease_version is distinct from (p_args->>'leaseVersion')::integer or v_task.lease_until is null or v_task.lease_until<=v_now then raise exception 'stale task lease' using errcode='40001'; end if;
    if v_task.profile_revision is distinct from v_profile.revision or v_task.settings_revision is distinct from v_settings.revision or v_task.answers_revision is distinct from v_profile.answers_revision then raise exception 'revision conflict' using errcode='40001'; end if;
    if exists(select 1 from public.apply_binding_state where binding_id=p_binding and status<>'ready') then raise exception 'agent paused' using errcode='42501'; end if;
    if not exists(select 1 from public.apply_runs where id=v_task.run_id and user_id=p_user and status<>'cancelled') or exists(select 1 from public.apply_submission_reservations where task_id=v_task.id) then raise exception 'task unavailable' using errcode='40001'; end if;
    if p_action='tasks.decide' then
      v_decision:=p_args->'decision';
      if not public.apply_pipeline_learning_decision_valid(v_task,v_profile,v_settings,v_decision,v_now) then raise exception 'invalid grounded match decision' using errcode='22023'; end if;
      v_task.match_decision:=v_decision||jsonb_build_object('eligible',v_decision->>'status' in ('eligible_review','eligible_auto'),'score',v_task.score,'profileRevision',v_profile.revision,'settingsRevision',v_settings.revision,'answersRevision',v_profile.answers_revision,'jobUrl',v_task.job->>'jobUrl','decidedAt',v_now);
      if v_decision->>'status' in ('eligible_auto','eligible_review') and not public.apply_pipeline_learning_safe(v_task,v_profile,v_settings,v_now) then raise exception 'factual match gates failed' using errcode='42501'; end if;
      if v_decision->>'status'='eligible_auto' and (not public.apply_pipeline_learning_auto_target(v_task)
        or v_settings.data->>'enabled' is distinct from 'true' or v_settings.data->>'autoSubmit' is distinct from 'true' or not v_profile.resume_approved) then raise exception 'explicit supported auto target required' using errcode='42501'; end if;
      if v_decision->>'status'='eligible_auto' and not exists(select 1 from public.apply_match_grants g where g.id=(v_decision->>'grantId')::uuid and g.user_id=p_user and g.source='user'
        and g.revoked_at is null and g.profile_revision=v_profile.revision and g.settings_revision=v_settings.revision and g.similarity_key=v_decision->>'similarityKey'
        and g.portal=v_decision->>'portal' and g.granted_at<=v_now and g.expires_at>v_now and g.expires_at<=g.granted_at+interval '30 days') then raise exception 'current autonomy grant required' using errcode='42501'; end if;
      update public.apply_tasks set match_decision=v_task.match_decision,status=case v_decision->>'status' when 'eligible_auto' then 'in_progress' when 'eligible_review' then 'waiting_review' else v_decision->>'status' end,
        reason=v_decision->>'reason',lease_until=case when v_decision->>'status'='eligible_auto' then lease_until else null end,
        lease_nonce=case when v_decision->>'status'='eligible_auto' then lease_nonce else null end,claimed_by=case when v_decision->>'status'='eligible_auto' then claimed_by else null end,
        lease_version=lease_version+case when v_decision->>'status'='eligible_auto' then 0 else 1 end,updated_at=v_now where id=v_task.id returning * into v_task;
      return jsonb_build_object('task',to_jsonb(v_task)-'user_id');
    else
      if not public.apply_pipeline_learning_auto_target(v_task) then raise exception 'explicit supported auto target required' using errcode='42501'; end if;
      if v_task.match_decision->>'status' is distinct from 'eligible_auto' or p_args->>'similarityKey' is distinct from v_task.match_decision->>'similarityKey'
        or p_args->>'grantId' is distinct from v_task.match_decision->>'grantId' or not public.apply_pipeline_learning_safe(v_task,v_profile,v_settings,v_now) then raise exception 'stored safe auto decision required' using errcode='42501'; end if;
      select * into v_grant from public.apply_match_grants where id=(p_args->>'grantId')::uuid and user_id=p_user and source='user' and revoked_at is null
        and similarity_key=v_task.match_decision->>'similarityKey' and portal=v_task.match_decision->>'portal' and profile_revision=v_profile.revision and settings_revision=v_settings.revision
        and granted_at<=v_now and expires_at>v_now and expires_at<=granted_at+interval '30 days' for update;
      if not found then raise exception 'current scoped autonomy grant required' using errcode='42501'; end if;
      /* Delegate unchanged guards while holding binding + owner + task + grant.
         grantId/similarityKey are wrapper-only, never bypass base argument checks. */
      return public.apply_pipeline_action_pre_learning(p_user,p_binding,p_action,p_args-'grantId'-'similarityKey');
    end if;
  end if;

  if p_args->'confirm' is distinct from 'true'::jsonb then raise exception 'explicit user confirmation required' using errcode='22023'; end if;
  if (p_args->>'profileRevision')::integer is distinct from v_profile.revision or (p_args->>'settingsRevision')::integer is distinct from v_settings.revision
    or v_task.profile_revision is distinct from v_profile.revision or v_task.settings_revision is distinct from v_settings.revision
    or not public.apply_pipeline_learning_decision_valid(v_task,v_profile,v_settings,v_task.match_decision,v_now)
    or (v_task.match_decision->>'profileRevision')::integer is distinct from v_profile.revision or (v_task.match_decision->>'settingsRevision')::integer is distinct from v_settings.revision
    or v_task.match_decision->>'jobUrl' is distinct from v_task.job->>'jobUrl' then raise exception 'current stored match decision required' using errcode='40001'; end if;
  v_key:=v_task.match_decision->>'similarityKey'; v_portal:=v_task.match_decision->>'portal';
  if p_action='learning.feedback' then
    if coalesce(p_args->>'scope','') not in ('exact','similar') or coalesce(p_args->>'verdict','') not in ('apply','skip') then raise exception 'invalid feedback' using errcode='22023'; end if;
    v_scope:=p_args->>'scope';
    update public.apply_match_feedback set revoked_at=v_now where user_id=p_user and task_id=v_task.id and scope=v_scope and revoked_at is null;
    v_old:=found;
    insert into public.apply_match_feedback(user_id,task_id,job_url,job_key,similarity_key,portal,scope,verdict,profile_revision,settings_revision,confirmed_at)
      values(p_user,v_task.id,v_task.job->>'jobUrl',v_task.job_key,v_key,v_portal,v_scope,p_args->>'verdict',v_profile.revision,v_settings.revision,v_now) returning * into v_feedback;
    if v_old or p_args->>'verdict'='skip' then
      update public.apply_match_grants set revoked_at=coalesce(revoked_at,v_now) where user_id=p_user and similarity_key=v_key and portal=v_portal and revoked_at is null;
      perform public.apply_pipeline_learning_fence(p_user,v_key,v_portal,null,'feedback_changed');
    end if;
    if p_args->>'verdict'='skip' then
      update public.apply_tasks t set status='user_skipped',reason='user_skip',lease_version=lease_version+1,lease_until=null,lease_nonce=null,claimed_by=null,updated_at=v_now
        where t.user_id=p_user and t.status in ('queued','in_progress','waiting_review','waiting_answer','waiting_login','manual_actionable','waiting_match_answer','user_skipped','filtered')
        and (v_scope='exact' and t.id=v_task.id or v_scope='similar' and t.match_decision->>'similarityKey'=v_key and t.match_decision->>'portal'=v_portal)
        and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id);
      for v_run_id in select distinct t.run_id from public.apply_tasks t where t.user_id=p_user and t.status='user_skipped' and t.updated_at=v_now
        and (v_scope='exact' and t.id=v_task.id or v_scope='similar' and t.match_decision->>'similarityKey'=v_key and t.match_decision->>'portal'=v_portal) loop
        perform public.apply_pipeline_refresh_run(v_run_id);
      end loop;
    end if;
    return jsonb_build_object('ok',true,'feedback',public.apply_pipeline_learning_feedback_json(v_feedback));
  elsif p_action='learning.question' then
    if coalesce(p_args->>'answer','') not in ('yes','no','unsure') or v_task.status<>'waiting_match_answer' or not v_task.match_decision ? 'question' then raise exception 'pending close-match question required' using errcode='22023'; end if;
    insert into public.apply_match_questions(user_id,task_id,job_url,similarity_key,portal,profile_revision,settings_revision,question,answer,suggestion,answered_at)
      values(p_user,v_task.id,v_task.job->>'jobUrl',v_key,v_portal,v_profile.revision,v_settings.revision,v_task.match_decision->'question',p_args->>'answer',case when p_args->>'answer'='yes' then 'profile_update' else 'none' end,v_now)
      on conflict(user_id,task_id,profile_revision,settings_revision) do update set answer=excluded.answer,suggestion=excluded.suggestion,answered_at=excluded.answered_at returning * into v_question;
    /* Not an answer-bank or profile mutation. All facts still require the
       separate profile-confirm + approved-resume workflow and fresh decision. */
    return jsonb_build_object('ok',true,'question',public.apply_pipeline_learning_question_json(v_question));
  elsif p_action='learning.manual_report' then
    if exists(select 1 from public.apply_submission_reservations r where r.task_id=v_task.id) or v_task.status in ('submitting','submitted','unverified') then raise exception 'irreversible task cannot be self reported' using errcode='40001'; end if;
    insert into public.apply_match_manual_receipts(user_id,task_id,job_url,job_key,similarity_key,portal,profile_revision,settings_revision,source,reported_at)
      values(p_user,v_task.id,v_task.job->>'jobUrl',v_task.job_key,v_key,v_portal,v_profile.revision,v_settings.revision,'user',v_now)
      on conflict(user_id,job_key,profile_revision,settings_revision,source) do update set reported_at=excluded.reported_at returning * into v_receipt;
    update public.apply_tasks set status='manual_applied',reason='user_self_report_not_observed',lease_version=lease_version+1,lease_until=null,lease_nonce=null,claimed_by=null,updated_at=v_now where id=v_task.id;
    perform public.apply_pipeline_refresh_run(v_task.run_id);
    return jsonb_build_object('ok',true,'receipt',public.apply_pipeline_learning_receipt_json(v_receipt));
  elsif p_action='learning.grant' then
    v_expiry:=(p_args->>'expiresAt')::timestamptz;
    if v_expiry is null or not isfinite(v_expiry) or v_expiry<=v_now or v_expiry>v_now+interval '30 days' then raise exception 'explicit future expiry within 30 days required' using errcode='22023'; end if;
    /* Counts are computed again inside this locked transaction, not accepted
       from a UI list, worker assertion or caller-supplied receipt evidence. */
    v_eligibility:=public.apply_pipeline_learning_eligibility(v_task,v_profile,v_settings,v_now);
    if v_eligibility->'eligible' is distinct from 'true'::jsonb then raise exception 'three current similar apply jobs and two observed manual receipts plus safe task required' using errcode='42501'; end if;
    update public.apply_match_grants set revoked_at=v_now where user_id=p_user and similarity_key=v_key and portal=v_portal and revoked_at is null;
    insert into public.apply_match_grants(user_id,task_id,similarity_key,portal,profile_revision,settings_revision,granted_at,expires_at)
      values(p_user,v_task.id,v_key,v_portal,v_profile.revision,v_settings.revision,v_now,v_expiry) returning * into v_grant;
    /* Requeue only explicitly selected, current safe tasks for a fresh decision.
       Do not turn a manual/core mismatch/question/skip or paused binding auto. */
    for v_task in select t.* from public.apply_tasks t where t.user_id=p_user and t.match_decision->>'similarityKey'=v_key and t.match_decision->>'portal'=v_portal
      and t.status in ('waiting_review','queued','in_progress') and t.profile_revision=v_profile.revision and t.settings_revision=v_settings.revision and t.answers_revision=v_profile.answers_revision
      and exists(select 1 from public.apply_agent_bindings b where b.id=t.target_binding_id and b.user_id=p_user and b.revoked_at is null)
      and not exists(select 1 from public.apply_binding_state s where s.binding_id=t.target_binding_id and s.status<>'ready')
      and exists(select 1 from public.apply_runs r where r.id=t.run_id and r.user_id=p_user and r.status<>'cancelled')
      and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id) loop
      if public.apply_pipeline_learning_safe(v_task,v_profile,v_settings,v_now) and public.apply_pipeline_learning_auto_target(v_task) then
        update public.apply_tasks set status='queued',reason='scoped_grant_requires_fresh_decision',lease_version=lease_version+1,lease_until=null,lease_nonce=null,claimed_by=null,updated_at=v_now where id=v_task.id;
        update public.apply_runs set status='queued',finished_at=null where id=v_task.run_id and status='completed';
      end if;
    end loop;
    return jsonb_build_object('ok',true,'grant',public.apply_pipeline_learning_grant_json(v_grant));
  end if;
  raise exception 'unsupported action' using errcode='22023';
end $$;

/* Existing entrypoints still call public.apply_pipeline_action by name. Do
   not expose either dispatcher or helpers, including old base RPC overloads. */
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'apply_pipeline_%' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
  end loop;
end $$;

commit;

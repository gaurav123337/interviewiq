/* Autonomous verified-answer-bank pipeline. Apply manually after the tenant,
   grants and pairing migrations; this is additive and safe to re-run.
   No legacy form memory is promoted to confirmed evidence. All client writes
   pass through own-auth or a transactionally locked paired binding. */

create table if not exists public.apply_verified_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  answers_revision integer not null default 0 check (answers_revision >= 0),
  facts jsonb not null default '{}' check (jsonb_typeof(facts) = 'object'),
  resume_text text not null default '' check (char_length(resume_text) <= 12000),
  resume_approved boolean not null default false,
  confirmed_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.apply_pipeline_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  data jsonb not null default '{"enabled":false,"autoSubmit":false,"threshold":60,"dailyCap":10,"weeklyCap":50,"employerDailyCap":2,"timeZone":"UTC","roles":[],"locations":[],"countries":[],"excludeCompanies":[],"requireWorkAuthorization":false,"allowSponsorship":true,"maxAgeDays":14,"aiConsent":false}',
  updated_at timestamptz not null default now(), check (jsonb_typeof(data) = 'object')
);
create table if not exists public.apply_verified_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null, meaning text not null,
  question_text text not null, control_type text not null,
  options jsonb not null default '[]', context jsonb not null default '{}',
  answer text not null check (char_length(answer) between 1 and 12000),
  scope text not null check (scope in ('global','country','employer','portal','application')),
  scope_key text not null default '', profile_revision integer not null,
  confirmed_at timestamptz not null default now(), expires_at timestamptz,
  provenance text not null default 'user' check (provenance = 'user'),
  revoked_at timestamptz, revoke_reason text,
  check ((scope = 'global' and scope_key = '') or (scope <> 'global' and char_length(scope_key) > 0)),
  check (jsonb_typeof(options) = 'array' and jsonb_typeof(context) = 'object'),
  check (expires_at is null or expires_at > confirmed_at)
);
create index if not exists apply_verified_answers_owner_idx on public.apply_verified_answers(user_id, confirmed_at desc);
create table if not exists public.apply_discovered_boards (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  url text not null, host text not null, label text not null, type text not null default 'manual',
  status text not null default 'pending' check (status in ('pending','disabled','dead')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,url), unique(id,user_id)
);
create table if not exists public.apply_discovered_jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid not null, job_key text not null, job jsonb not null,
  discovered_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (board_id,user_id) references public.apply_discovered_boards(id,user_id) on delete cascade,
  unique(user_id,job_key), check (jsonb_typeof(job) = 'object')
);
create table if not exists public.apply_runs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  binding_id uuid not null references public.apply_agent_bindings(id),
  mode text not null check (mode in ('review','auto')),
  status text not null default 'queued' check (status in ('queued','running','completed','cancelled')),
  profile_revision integer not null, settings_revision integer not null, answers_revision integer not null,
  candidate_count integer not null default 0, task_count integer not null default 0,
  created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz,
  unique(id,user_id)
);
create table if not exists public.apply_tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null, target_binding_id uuid not null references public.apply_agent_bindings(id),
  job_key text not null, job jsonb not null,
  status text not null default 'queued' check (status in ('queued','in_progress','submitting','waiting_answer','waiting_login','waiting_review','unsupported','submitted','unverified','failed','cancelled','filtered')),
  score integer not null check (score between 0 and 100), reason text,
  profile_revision integer not null, settings_revision integer not null, answers_revision integer not null,
  lease_version integer not null default 0, lease_until timestamptz, lease_nonce uuid,
  claimed_by uuid references public.apply_agent_bindings(id), evidence jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (run_id,user_id) references public.apply_runs(id,user_id),
  unique(user_id,job_key), unique(id,user_id), check (jsonb_typeof(job) = 'object')
);
create index if not exists apply_tasks_claim_idx on public.apply_tasks(user_id,target_binding_id,status,created_at);
create table if not exists public.apply_question_inbox (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null, meaning text not null, question_text text not null,
  control_type text not null check (control_type in ('text','textarea','select','radio','checkbox','number','date','email','tel','url')),
  options jsonb not null default '[]', context jsonb not null default '{}',
  scope text not null, scope_key text not null, currency text, reason text,
  profile_revision integer not null,
  status text not null default 'pending' check (status in ('pending','answered','dismissed')),
  answer_id uuid references public.apply_verified_answers(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,question_key), unique(id,user_id)
);
create table if not exists public.apply_question_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null, task_id uuid not null, job_context jsonb not null default '{}',
  foreign key(question_id,user_id) references public.apply_question_inbox(id,user_id) on delete cascade,
  foreign key(task_id,user_id) references public.apply_tasks(id,user_id) on delete cascade,
  primary key(question_id,task_id)
);
create table if not exists public.apply_submission_reservations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null unique, binding_id uuid not null references public.apply_agent_bindings(id),
  job_key text not null, employer_key text not null, nonce uuid not null default gen_random_uuid(),
  idempotency_key text not null, status text not null default 'reserved' check(status in ('reserved','submitted','unverified','failed')),
  lease_version integer not null, lease_nonce uuid not null,
  profile_revision integer not null, settings_revision integer not null, answers_revision integer not null,
  answer_ids jsonb not null default '[]', evidence jsonb,
  reserved_at timestamptz not null default now(), finished_at timestamptz,
  foreign key(task_id,user_id) references public.apply_tasks(id,user_id),
  unique(user_id,job_key), unique(user_id,idempotency_key)
);
create index if not exists apply_reservations_caps_idx on public.apply_submission_reservations(user_id,reserved_at,employer_key);
create table if not exists public.apply_binding_state (
  binding_id uuid primary key references public.apply_agent_bindings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  engine_version text not null, capabilities jsonb not null default '[]',
  status text not null check(status in ('ready','paused','offline')), control_paused boolean not null default false, profile_metadata jsonb not null default '{}',
  heartbeat_at timestamptz not null default now()
);
create table if not exists public.apply_binding_sessions (
  binding_id uuid not null references public.apply_agent_bindings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  portal text not null, status text not null check(status in ('authenticated','expired','login_required','unsupported')),
  account_label text, checked_at timestamptz not null default now(), primary key(binding_id,portal)
);
create table if not exists public.apply_binding_commands (
  id uuid primary key default gen_random_uuid(), binding_id uuid not null references public.apply_agent_bindings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check(type in ('pause','resume','retry_login','open_question','check_session')), args jsonb not null default '{}',
  status text not null default 'queued' check(status in ('queued','claimed','done','failed','cancelled')),
  task_id uuid references public.apply_tasks(id) on delete cascade, claim_nonce uuid,
  reason text, created_at timestamptz not null default now(), claimed_at timestamptz, finished_at timestamptz
);

alter table public.apply_question_inbox drop constraint if exists apply_question_inbox_control_type_check;
alter table public.apply_question_inbox add constraint apply_question_inbox_control_type_check
  check (control_type in ('text','textarea','select','radio','checkbox','number','date','email','tel','url'));
alter table public.apply_binding_state add column if not exists control_paused boolean not null default false;
alter table public.apply_question_tasks add column if not exists job_context jsonb not null default '{}';
alter table public.apply_binding_commands add column if not exists task_id uuid references public.apply_tasks(id) on delete cascade;
alter table public.apply_binding_commands add column if not exists claim_nonce uuid;

/* RPC-only tables: even platform admins cannot bypass another owner's privacy. */
do $$ declare t text; begin
  foreach t in array array['apply_verified_profiles','apply_pipeline_settings','apply_verified_answers',
    'apply_discovered_boards','apply_discovered_jobs','apply_runs','apply_tasks','apply_question_inbox',
    'apply_question_tasks','apply_submission_reservations','apply_binding_state','apply_binding_sessions','apply_binding_commands'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end $$;

create or replace function public.apply_pipeline_public_url(p_url text)
returns boolean language sql immutable set search_path = pg_catalog, public as $$
  select coalesce(char_length(p_url) <= 2048 and p_url !~ '[[:space:]\\#]' and p_url !~* '%(2f|5c|25|00)'
    and p_url !~* '[?&](url|redirect|redirect_uri|redirecturl|next|return|returnurl|continue|callback)='
    and p_url !~* '[?&][^=]+=(https?%3a|javascript%3a|data%3a|https?:|//)'
    and p_url ~ '^https://[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(:443)?([/?][^[:space:]]*)?$'
    and split_part(split_part(substr(p_url,9),'/',1),'?',1) !~ '^([0-9]+\.)+[0-9]+(:443)?$'
    and lower(split_part(split_part(split_part(substr(p_url,9),'/',1),'?',1),'#',1)) !~ '(^|\.)(localhost|local|internal|test|invalid)(:443)?$',false)
$$;
create or replace function public.apply_pipeline_host(p_url text)
returns text language sql immutable set search_path = pg_catalog, public as $$
  select lower(regexp_replace(split_part(split_part(split_part(substr(p_url,9),'/',1),'?',1),'#',1),':443$',''))
$$;
/* Preserve case-sensitive posting paths and identity query parameters. Strip
   tracking only: unlike legacy review keys, ?job=1 and ?job=2 must not collide. */
create or replace function public.apply_pipeline_auto_site(p_job jsonb)
returns text language plpgsql immutable set search_path = pg_catalog, public as $$
declare v_host text:=public.apply_pipeline_host(p_job->>'jobUrl'); v_path text; begin
  if not public.apply_pipeline_public_url(p_job->>'jobUrl') then return null; end if;
  v_path:=split_part(substr(p_job->>'jobUrl',9),'?',1); v_path:=substr(v_path,char_length(split_part(v_path,'/',1))+1);
  if v_host in ('boards.greenhouse.io','job-boards.greenhouse.io') and v_path ~ '^/[a-zA-Z0-9_-]+/jobs/[0-9]+/?$' then return 'greenhouse'; end if;
  if v_host='jobs.ashbyhq.com' and v_path ~ '^/[a-zA-Z0-9_-]+/[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}(/application|/apply)?/?$' then return 'ashby'; end if;
  if v_host in ('www.naukri.com','naukri.com') and v_path ~ '^/job-listings-[a-zA-Z0-9-]+-[0-9]{8,}/?$' then return 'naukri'; end if;
  if v_host in ('www.instahyre.com','instahyre.com') and v_path ~ '^/job-[0-9]+-[a-zA-Z0-9-]+/?$' then return 'instahyre'; end if;
  return null;
end $$;
create or replace function public.apply_pipeline_receipt_url(p_job_url text,p_receipt_url text)
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
declare v_job text; v_receipt text; v_base text; begin
  if not public.apply_pipeline_public_url(p_job_url) or not public.apply_pipeline_public_url(p_receipt_url) then return false; end if;
  v_job:=public.apply_pipeline_job_key(p_job_url); v_receipt:=public.apply_pipeline_job_key(p_receipt_url);
  if v_job=v_receipt then return true; end if;
  v_base:=regexp_replace(split_part(v_job,'?',1),'/(apply|application)$','');
  return v_receipt in (v_base||'/thanks',v_base||'/confirmation',v_base||'/submitted')
    or split_part(v_receipt,'?',1)=v_base and split_part(v_receipt,'?',2) ~ '^submissionId=[a-zA-Z0-9_-]{4,200}$';
end $$;
create or replace function public.apply_pipeline_portal_fact(p_fact jsonb,p_portal text,p_now timestamptz)
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
declare v_confirmed timestamptz; v_until timestamptz; begin
  if p_fact->>'source' is distinct from 'user' or p_fact->'scope' is distinct from jsonb_build_object('portal',p_portal) then return false; end if;
  v_confirmed:=(p_fact->>'confirmedAt')::timestamptz; v_until:=(p_fact->>'validUntil')::timestamptz;
  return coalesce(v_confirmed<=p_now and v_confirmed>p_now-interval '30 days' and v_until>p_now and v_until<=v_confirmed+interval '30 days',false);
exception when others then return false;
end $$;
create or replace function public.apply_pipeline_country(p_country text)
returns text language sql immutable set search_path = pg_catalog, public as $$
  select case lower(btrim(p_country)) when 'india' then 'IN' when 'united states' then 'US' when 'united states of america' then 'US'
    when 'usa' then 'US' when 'u.s.' then 'US' when 'united kingdom' then 'GB' when 'uk' then 'GB'
    when 'canada' then 'CA' when 'germany' then 'DE' when 'australia' then 'AU' when 'singapore' then 'SG'
    else upper(btrim(p_country)) end
$$;
/* Only literal, deterministic label aliases can acquire reusable meaning. A
   caller-supplied meaning/hash never promotes an unknown label to global. */
create or replace function public.apply_pipeline_question_label(p_text text)
returns jsonb language plpgsql immutable set search_path = pg_catalog, public as $$
declare q text:=lower(regexp_replace(btrim(p_text),'\s+',' ','g')); v_currency text; v_country text; v_meaning text; v_match text[];
begin
  q:=btrim(regexp_replace(q,'[?*:.]+$',''));
  v_match:=regexp_match(q,'(?:\s*\((usd|inr|gbp|eur|cad|aud|sgd)\)|\s+(?:in\s+)?(usd|inr|gbp|eur|cad|aud|sgd))$');
  if v_match is not null then v_currency:=upper(coalesce(v_match[1],v_match[2])); q:=btrim(regexp_replace(q,'(?:\s*\((usd|inr|gbp|eur|cad|aud|sgd)\)|\s+(?:in\s+)?(usd|inr|gbp|eur|cad|aud|sgd))$','')); end if;
  v_match:=regexp_match(q,'\s+in\s+(india|united states(?: of america)?|usa|us|united kingdom|uk|canada|germany|australia|singapore)$');
  if v_match is not null then v_country:=public.apply_pipeline_country(v_match[1]); q:=btrim(regexp_replace(q,'\s+in\s+(india|united states(?: of america)?|usa|us|united kingdom|uk|canada|germany|australia|singapore)$','')); end if;
  v_meaning:=case
    when q in ('full name','your name','name','legal name') then 'name'
    when q in ('first name','given name') then 'firstName' when q in ('last name','surname','family name') then 'lastName'
    when q in ('email','email address','e-mail','e-mail address','your email address') then 'email'
    when q in ('phone','phone number','mobile number','contact number','telephone number') then 'phone'
    when q in ('current location','current city','city of residence','where do you live') then 'location'
    when q in ('preferred locations','preferred work locations') then 'locations'
    when q in ('total years of experience','years of experience','total experience','how many years of experience do you have') then 'yearsExperience'
    when q in ('notice period','what is your notice period','availability','when can you start') then 'noticePeriod'
    when q in ('current salary','current ctc','current compensation','what is your current salary') then 'currentSalary'
    when q in ('expected salary','expected ctc','salary expectation','salary expectations','desired salary','expected compensation','what are your salary expectations') then 'expectedSalary'
    when q in ('work authorization','are you legally authorized to work','are you authorized to work','are you legally eligible to work','are you eligible to work') then 'workAuthorization'
    when q in ('do you require sponsorship','will you require sponsorship','do you now or in the future require sponsorship','will you now or in the future require sponsorship','do you require visa sponsorship') then 'requiresSponsorship'
    when q in ('are you willing to relocate','willing to relocate','open to relocation') then 'relocation'
    when q in ('linkedin','linkedin profile','linkedin url') then 'linkedin'
    when q in ('portfolio','portfolio url','website','personal website') then 'portfolio'
    when q in ('skills','technical skills') then 'skills' when q in ('current role','job role','occupation') then 'role'
    else null end;
  if v_meaning is null then
    v_match:=coalesce(regexp_match(q,'^(?:how many )?years of (.+?) experience(?: do you have)?$'),
      regexp_match(q,'^(?:how many )?years (?:of )?experience (?:with|in) (.+?)(?: do you have)?$'));
    if v_match is not null and v_match[1] ~ '^[a-z0-9+#. /-]{1,80}$' then
      v_meaning:='skillYears:'||case v_match[1]
        when 'react.js' then 'react' when 'reactjs' then 'react' when 'node.js' then 'node' when 'nodejs' then 'node'
        when 'vue.js' then 'vue' when 'vuejs' then 'vue' when 'next.js' then 'next' when 'nextjs' then 'next'
        when 'js' then 'javascript' when 'ts' then 'typescript' when 'c sharp' then 'c#' when 'c plus plus' then 'c++'
        when 'golang' then 'go' when 'amazon web services' then 'aws' else v_match[1] end;
    end if;
  end if;
  return jsonb_strip_nulls(jsonb_build_object('meaning',v_meaning,'country',v_country,'currency',v_currency));
end $$;
create or replace function public.apply_pipeline_job_context(p_job jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog, public as $$
declare v_host text:=public.apply_pipeline_host(p_job->>'jobUrl'); v_path text; v_portal text;
begin
  v_path:=split_part(split_part(substr(p_job->>'jobUrl',9),'?',1),'#',1);
  v_path:=substr(v_path,char_length(split_part(v_path,'/',1))+2);
  v_portal:=case
    when v_host in ('boards.greenhouse.io','job-boards.greenhouse.io') then 'greenhouse:'||v_host||'/'||split_part(v_path,'/',1)
    when v_host='jobs.ashbyhq.com' then 'ashby:'||v_host||'/'||split_part(v_path,'/',1)
    when v_host='jobs.lever.co' then 'lever:'||v_host||'/'||split_part(v_path,'/',1)
    when v_host in ('www.naukri.com','naukri.com') then 'naukri:'||v_host||'/candidate'
    when v_host in ('www.instahyre.com','instahyre.com') then 'instahyre:'||v_host||'/candidate'
    else coalesce(p_job->>'portal',v_host) end;
  return jsonb_strip_nulls(jsonb_build_object('country',public.apply_pipeline_country(p_job->>'country'),'employer',lower(btrim(p_job->>'company')),
    'portal',lower(v_portal),'application',p_job->>'jobUrl','currency',p_job->'salary'->>'currency'));
end $$;
create or replace function public.apply_pipeline_command_portal(p_job jsonb,p_portal text)
returns boolean language sql immutable set search_path = pg_catalog, public as $$
  select coalesce(p_portal in (public.apply_pipeline_job_context(p_job)->>'portal',public.apply_pipeline_host(p_job->>'jobUrl'),
    public.apply_pipeline_auto_site(p_job),p_job->>'portal'),false)
$$;
create or replace function public.apply_pipeline_job_key(p_url text)
returns text language plpgsql immutable set search_path = pg_catalog, public as $$
declare v_path text; v_query text; v_pair text; v_pairs text[] := '{}'; v_key text; begin
  if not public.apply_pipeline_public_url(p_url) then return null; end if;
  v_path := split_part(split_part(substr(p_url,9),'#',1),'?',1);
  v_path := substr(v_path,char_length(split_part(v_path,'/',1))+1);
  v_path := regexp_replace(v_path,'/+$','');
  if position('?' in split_part(p_url,'#',1)) > 0 then
    v_query := split_part(split_part(p_url,'#',1),'?',2);
    foreach v_pair in array string_to_array(v_query,'&') loop
      v_key := lower(split_part(v_pair,'=',1));
      if v_key <> '' and v_key !~ '^(utm_.*|ref|referrer|source|trk|trackingid|gh_src|fbclid|gclid)$' then v_pairs := array_append(v_pairs,v_pair); end if;
    end loop;
  end if;
  select coalesce(array_agg(x order by x),'{}') into v_pairs from unnest(v_pairs) x;
  return 'https://' || public.apply_pipeline_host(p_url) || v_path || case when cardinality(v_pairs)>0 then '?' || array_to_string(v_pairs,'&') else '' end;
end $$;
create or replace function public.apply_pipeline_forbidden_keys(p_value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
declare k text; v jsonb; begin
  if jsonb_typeof(p_value)='object' then
    for k,v in select * from jsonb_each(p_value) loop
      if regexp_replace(lower(k),'[^a-z]','','g') = any(array['user','userid','useruuid','uid','owner','ownerid','owneruuid','puser','puserid','puid','token','tokenhash','cookie','cookies','password','secret','authorization','servicerolekey']) then return true; end if;
      if public.apply_pipeline_forbidden_keys(v) then return true; end if;
    end loop;
  elsif jsonb_typeof(p_value)='array' then
    for v in select * from jsonb_array_elements(p_value) loop if public.apply_pipeline_forbidden_keys(v) then return true; end if; end loop;
  end if;
  return false;
end $$;
create or replace function public.apply_pipeline_keys(p_value jsonb,p_allowed text[])
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
begin
  if jsonb_typeof(p_value) is distinct from 'object' then return false; end if;
  return not exists(select 1 from jsonb_object_keys(p_value) k where not k=any(p_allowed));
end $$;
create or replace function public.apply_pipeline_strings(p_value jsonb,p_max integer,p_length integer)
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
begin
  if jsonb_typeof(p_value) is distinct from 'array' or jsonb_array_length(p_value)>p_max then return false; end if;
  return not exists(select 1 from jsonb_array_elements(p_value) v where jsonb_typeof(v)<>'string' or char_length(v#>>'{}') not between 1 and p_length);
end $$;
create or replace function public.apply_pipeline_salary(p_value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
begin
  if not public.apply_pipeline_keys(p_value,array['value','currency','period']) or jsonb_typeof(p_value->'value') is distinct from 'number' then return false; end if;
  return (p_value->>'value')::numeric between 0 and 1000000000 and p_value->>'currency' ~ '^[A-Z]{3}$' and p_value->>'period' in ('year','month','hour');
end $$;
create or replace function public.apply_pipeline_job_salary(p_value jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
declare k text; begin
  if not public.apply_pipeline_keys(p_value,array['min','max','currency','period']) or not (p_value ? 'min' or p_value ? 'max') then return false; end if;
  foreach k in array array['min','max'] loop
    if p_value ? k and (jsonb_typeof(p_value->k) is distinct from 'number' or (p_value->>k)::numeric not between 0 and 1000000000) then return false; end if;
  end loop;
  return p_value->>'currency' ~ '^[A-Z]{3}$' and p_value->>'period' in ('year','month','hour') and (not p_value ? 'min' or not p_value ? 'max' or (p_value->>'min')::numeric<=(p_value->>'max')::numeric);
end $$;
create or replace function public.apply_pipeline_confirmed_fact(p_fact jsonb,p_now timestamptz,p_country text default null)
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
begin
  if p_fact->>'source' is distinct from 'user' or p_fact->>'confirmedAt' is null or (p_fact->>'confirmedAt')::timestamptz>p_now
    or p_fact ? 'validUntil' and (p_fact->>'validUntil')::timestamptz<=p_now then return false; end if;
  return case when p_country is null then not p_fact ? 'scope' else lower(p_fact->'scope'->>'country')=lower(p_country) end;
exception when others then return false;
end $$;
create or replace function public.apply_pipeline_validate_settings(p_data jsonb)
returns boolean language plpgsql stable set search_path = pg_catalog, public as $$
declare k text; begin
  if not public.apply_pipeline_keys(p_data,array['enabled','autoSubmit','threshold','dailyCap','weeklyCap','employerDailyCap','timeZone','roles','locations','countries','excludeCompanies','minimumSalary','requireWorkAuthorization','allowSponsorship','maxAgeDays','aiConsent','quietFrom','quietTo']) then return false; end if;
  foreach k in array array['enabled','autoSubmit','aiConsent','requireWorkAuthorization','allowSponsorship'] loop if jsonb_typeof(p_data->k) is distinct from 'boolean' then return false; end if; end loop;
  foreach k in array array['threshold','dailyCap','weeklyCap','employerDailyCap','maxAgeDays'] loop
    if coalesce(p_data->>k,'') !~ '^[0-9]+$' then return false; end if;
  end loop;
  if (p_data->>'threshold')::numeric>100 or (p_data->>'dailyCap')::numeric>100 or (p_data->>'weeklyCap')::numeric>500 or (p_data->>'employerDailyCap')::numeric>20
    or (p_data->>'maxAgeDays')::numeric not between 1 and 90 then return false; end if;
  if not public.apply_pipeline_strings(p_data->'roles',30,200) or not public.apply_pipeline_strings(p_data->'locations',30,200)
    or not public.apply_pipeline_strings(p_data->'countries',100,200) or not public.apply_pipeline_strings(p_data->'excludeCompanies',100,200) then return false; end if;
  if p_data ? 'minimumSalary' and not public.apply_pipeline_salary(p_data->'minimumSalary') then return false; end if;
  if not exists(select 1 from pg_timezone_names where name=p_data->>'timeZone') then return false; end if;
  if (p_data ? 'quietFrom') <> (p_data ? 'quietTo') then return false; end if;
  if p_data ? 'quietFrom' and (coalesce(p_data->>'quietFrom','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_data->>'quietTo','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then return false; end if;
  return true;
end $$;
create or replace function public.apply_pipeline_validate_job(p_job jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog, public as $$
begin
  return public.apply_pipeline_keys(p_job,array['jobUrl','title','company','description','skills','location','country','postedAt','source','externalId','remote','portal','salary'])
    and public.apply_pipeline_public_url(p_job->>'jobUrl')
    and jsonb_typeof(p_job->'title')='string' and char_length(p_job->>'title') between 1 and 500
    and jsonb_typeof(p_job->'company')='string' and char_length(p_job->>'company') between 1 and 500
    and jsonb_typeof(p_job->'description')='string' and char_length(p_job->>'description')<=50000
    and public.apply_pipeline_strings(p_job->'skills',100,200)
    and jsonb_typeof(p_job->'location')='string' and char_length(p_job->>'location')<=500
    and (not p_job ? 'salary' or public.apply_pipeline_job_salary(p_job->'salary'))
    and (not p_job ? 'remote' or jsonb_typeof(p_job->'remote')='boolean')
    and (not p_job ? 'country' or jsonb_typeof(p_job->'country')='string' and char_length(p_job->>'country') between 1 and 100)
    and (not p_job ? 'postedAt' or jsonb_typeof(p_job->'postedAt')='string' and p_job->>'postedAt' ~ '^\d{4}-\d{2}-\d{2}T')
    and (not p_job ? 'portal' or jsonb_typeof(p_job->'portal')='string' and char_length(p_job->>'portal') between 1 and 200)
    and (not p_job ? 'source' or jsonb_typeof(p_job->'source')='string' and char_length(p_job->>'source') between 1 and 100)
    and (not p_job ? 'externalId' or jsonb_typeof(p_job->'externalId')='string' and char_length(p_job->>'externalId') between 1 and 500);
end $$;
create or replace function public.apply_pipeline_match(p_facts jsonb,p_settings jsonb,p_job jsonb,p_now timestamptz default now())
returns jsonb language plpgsql stable set search_path = pg_catalog, public as $$
declare v_posted timestamptz; v_fact jsonb:=p_facts->'skills'; v_total integer; v_overlap integer; v_score integer:=0;
  v_roles jsonb:=p_settings->'roles'; v_locations jsonb:=p_settings->'locations';
begin
  if jsonb_array_length(v_roles)=0 and public.apply_pipeline_confirmed_fact(p_facts->'role',p_now) then v_roles:=jsonb_build_array(p_facts->'role'->>'value'); end if;
  if jsonb_array_length(v_locations)=0 and public.apply_pipeline_confirmed_fact(p_facts->'locations',p_now) and public.apply_pipeline_strings(p_facts->'locations'->'value',100,200) then v_locations:=p_facts->'locations'->'value'; end if;
  if not public.apply_pipeline_public_url(p_job->>'jobUrl') then return jsonb_build_object('score',0,'reason','invalid_job_url'); end if;
  if exists(select 1 from jsonb_array_elements_text(p_settings->'excludeCompanies') x where lower(btrim(x))=lower(btrim(p_job->>'company'))) then return jsonb_build_object('score',0,'reason','excluded_company'); end if;
  if jsonb_array_length(v_roles)=0 then return jsonb_build_object('score',0,'reason','confirmed_role_required'); end if;
  if not exists(select 1 from jsonb_array_elements_text(v_roles) x where position(lower(btrim(x)) in lower(p_job->>'title'))>0) then return jsonb_build_object('score',0,'reason','role_filter'); end if;
  if jsonb_array_length(v_locations)=0 then return jsonb_build_object('score',0,'reason','confirmed_locations_required'); end if;
  if not exists(select 1 from jsonb_array_elements_text(v_locations) x where position(lower(btrim(x)) in lower(p_job->>'location'))>0 or p_job->>'remote'='true' and lower(btrim(x))='remote') then return jsonb_build_object('score',0,'reason','location_filter'); end if;
  if jsonb_array_length(p_settings->'countries')>0 and not exists(select 1 from jsonb_array_elements_text(p_settings->'countries') x where lower(btrim(x))=lower(btrim(p_job->>'country'))) then return jsonb_build_object('score',0,'reason','country_filter'); end if;
  if p_settings ? 'minimumSalary' and (not p_job ? 'salary' or p_job->'salary'->>'currency' is distinct from p_settings->'minimumSalary'->>'currency'
    or p_job->'salary'->>'period' is distinct from p_settings->'minimumSalary'->>'period' or coalesce((p_job->'salary'->>'max')::numeric,(p_job->'salary'->>'min')::numeric,-1)<(p_settings->'minimumSalary'->>'value')::numeric) then return jsonb_build_object('score',0,'reason','salary_unknown_or_below_minimum'); end if;
  if p_settings->>'requireWorkAuthorization'='true' and (coalesce(p_job->>'country','')='' or not coalesce(public.apply_pipeline_confirmed_fact(p_facts->'workAuthorization',p_now,p_job->>'country'),false) or p_facts->'workAuthorization'->'value' is distinct from 'true'::jsonb) then return jsonb_build_object('score',0,'reason','work_authorization_unconfirmed'); end if;
  if p_settings->>'allowSponsorship'='false' and (coalesce(p_job->>'country','')='' or not coalesce(public.apply_pipeline_confirmed_fact(p_facts->'requiresSponsorship',p_now,p_job->>'country'),false) or p_facts->'requiresSponsorship'->'value' is distinct from 'false'::jsonb) then return jsonb_build_object('score',0,'reason','sponsorship_unconfirmed_or_required'); end if;
  begin v_posted:=(p_job->>'postedAt')::timestamptz; exception when others then v_posted:=null; end;
  if v_posted is null or v_posted>p_now+interval '1 day' or v_posted<p_now-make_interval(days=>(p_settings->>'maxAgeDays')::integer) then return jsonb_build_object('score',0,'reason','posting_age_unknown_or_stale'); end if;
  if v_fact is null or v_fact->>'source'<>'user' or v_fact ? 'scope' or not public.apply_pipeline_strings(v_fact->'value',100,200) or jsonb_array_length(v_fact->'value')=0 then return jsonb_build_object('score',0,'reason','confirmed_skills_required'); end if;
  begin
    if (v_fact->>'confirmedAt')::timestamptz is null or (v_fact->>'confirmedAt')::timestamptz>p_now or v_fact ? 'validUntil' and (v_fact->>'validUntil')::timestamptz<=p_now then return jsonb_build_object('score',0,'reason','confirmed_skills_required'); end if;
  exception when others then return jsonb_build_object('score',0,'reason','confirmed_skills_required'); end;
  select count(*),count(*) filter(where exists(select 1 from jsonb_array_elements_text(v_fact->'value') s where lower(btrim(s))=r.skill)) into v_total,v_overlap
    from (select distinct lower(btrim(x)) skill from jsonb_array_elements_text(p_job->'skills') x where btrim(x)<>'') r;
  if v_total=0 then return jsonb_build_object('score',0,'reason','confirmed_skills_required'); end if;
  v_score:=floor(100.0*v_overlap/v_total);
  return jsonb_build_object('score',v_score,'reason',case when v_score<(p_settings->>'threshold')::integer then 'below_threshold' else null end);
end $$;

/* Public feed is read-only. Dynamic selection degrades honestly when jobs.sql
   has not been installed; the task's JSON snapshot never changes afterwards. */
create or replace function public.apply_pipeline_jobs(p_user uuid,p_offset integer,p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_public jsonb:='[]'; v_private jsonb; begin
  if to_regclass('public.jobs') is not null then
    execute $q$select coalesce(jsonb_agg(j),'[]'::jsonb) from (
      select jsonb_strip_nulls(jsonb_build_object('jobUrl',url,'title',title,'company',company,'description',left(description,50000),
        'skills',skills,'location',coalesce(location,''),'remote',remote,'postedAt',posted_at,'source',source,'externalId',external_id,
        'country',to_jsonb(jobs)->'meta'->>'country','salary',case when public.apply_pipeline_job_salary(salary) then salary else null end)) j
      from public.jobs order by posted_at desc nulls last,id limit $1 offset $2) s$q$ into v_public using p_limit,p_offset;
  end if;
  select coalesce(jsonb_agg(job),'[]') into v_private from (select job from public.apply_discovered_jobs where user_id=p_user order by discovered_at desc,id limit p_limit offset p_offset) s;
  return v_public||v_private;
end $$;

create or replace function public.apply_pipeline_invalidate(p_user uuid,p_reason text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  update public.apply_tasks set status='waiting_review',reason=p_reason,lease_until=null,lease_nonce=null,claimed_by=null,
    lease_version=lease_version+1,updated_at=clock_timestamp()
    where user_id=p_user and status in ('queued','in_progress','waiting_answer','waiting_login','waiting_review')
      and not exists(select 1 from public.apply_submission_reservations r where r.task_id=apply_tasks.id);
end $$;
create or replace function public.apply_pipeline_refresh_run(p_run uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  update public.apply_runs set status='completed',finished_at=coalesce(finished_at,clock_timestamp()) where id=p_run and status<>'cancelled'
    and not exists(select 1 from public.apply_tasks where run_id=p_run and status in ('queued','in_progress','submitting','waiting_answer','waiting_login','waiting_review'));
end $$;

/* Internal dispatcher is not callable by any client role. Owner advisory locking
   serializes revisions, reservations and per-owner caps across all bindings. */
create or replace function public.apply_pipeline_action(p_user uuid,p_binding uuid,p_action text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_profile public.apply_verified_profiles%rowtype; v_settings public.apply_pipeline_settings%rowtype;
  v_task public.apply_tasks%rowtype; v_run public.apply_runs%rowtype; v_question public.apply_question_inbox%rowtype;
  v_answer public.apply_verified_answers%rowtype; v_res public.apply_submission_reservations%rowtype;
  v_board public.apply_discovered_boards%rowtype; v_command public.apply_binding_commands%rowtype;
  v_binding public.apply_agent_bindings%rowtype; v_allowed text[]; v_result jsonb; v_item jsonb; v_facts jsonb:='{}';
  v_key text; v_value jsonb; v_match jsonb; v_id uuid; v_limit integer:=100; v_seconds integer:=120;
  v_now timestamptz:=clock_timestamp(); v_local timestamp; v_day timestamptz; v_week timestamptz;
  v_scope text; v_scope_key text; v_question_key text; v_count integer:=0; v_candidates integer:=0;
  v_mode text; v_reason text; v_expected integer; v_cap integer; v_answer_id text; v_expiry timestamptz;
  v_context jsonb; v_label jsonb; v_options jsonb; v_known boolean;
begin
  if p_user is null or not exists(select 1 from auth.users where id=p_user) then raise exception 'forbidden' using errcode='42501'; end if;
  if jsonb_typeof(p_args) is distinct from 'object' or octet_length(p_args::text)>262144 or public.apply_pipeline_forbidden_keys(p_args) then raise exception 'invalid args' using errcode='22023'; end if;
  if p_binding is null then
    if not p_action=any(array['profile.get','profile.confirm','settings.get','settings.put','answers.list','answers.revoke','questions.list','questions.answer','boards.list','boards.add','run.request','run.list','run.cancel','tasks.list','agent.list','sessions.list','commands.request']) then raise exception 'unsupported action' using errcode='22023'; end if;
  elsif not p_action=any(array['profile.get','settings.get','answers.list','questions.queue','boards.list','boards.discover','jobs.list','jobs.ingest','tasks.claim','tasks.renew','tasks.report','submission.reserve','submission.finish','agent.heartbeat','sessions.report','commands.claim','commands.report']) then raise exception 'unsupported action' using errcode='22023'; end if;
  /* Reads and destructive cleanup remain available to the owner after expiry.
     A bound worker may only finish a previously reserved attempt after expiry. */
  if not public.service_apply_agent_has_access(p_user) and not (p_binding is null and p_action=any(array['profile.get','settings.get','settings.put','answers.list','answers.revoke','questions.list','boards.list','run.list','run.cancel','tasks.list','agent.list','sessions.list','commands.request']) or p_binding is not null and p_action='submission.finish') then raise exception 'not entitled' using errcode='42501'; end if;
  v_allowed:=case p_action
    when 'profile.get' then array[]::text[] when 'settings.get' then array[]::text[]
    when 'profile.confirm' then array['expectedRevision','facts','resumeText','resumeApproved']
    when 'settings.put' then array['expectedRevision','settings'] when 'answers.list' then array['limit','includeRevoked']
    when 'answers.revoke' then array['answerId'] when 'questions.list' then array['limit','status']
    when 'questions.answer' then array['questionId','answer','scope','scopeKey','expiresAt','confirm']
    when 'questions.queue' then array['taskId','leaseVersion','leaseNonce','question']
    when 'boards.discover' then array['url','label','type'] when 'boards.list' then array['limit'] when 'boards.add' then array['url','label','type']
    when 'run.request' then array['bindingId','limit','mode'] when 'run.list' then array['limit'] when 'run.cancel' then array['runId']
    when 'tasks.list' then array['runId','limit'] when 'jobs.list' then array['offset','limit'] when 'jobs.ingest' then array['boardId','jobs']
    when 'tasks.claim' then array['limit','leaseSeconds'] when 'tasks.renew' then array['taskId','leaseVersion','leaseNonce','leaseSeconds']
    when 'tasks.report' then array['taskId','leaseVersion','leaseNonce','status','reason','evidence']
    when 'submission.reserve' then array['taskId','leaseVersion','leaseNonce','profileRevision','settingsRevision','answersRevision','siteAllowed','accountVerified','requiredComplete','answerIds','idempotencyKey']
    when 'submission.finish' then array['taskId','leaseVersion','leaseNonce','reservationId','reservationNonce','outcome','evidence']
    when 'agent.list' then array['limit'] when 'agent.heartbeat' then array['engineVersion','capabilities','status','profileMetadata']
    when 'sessions.list' then array['limit'] when 'sessions.report' then array['portal','status','accountLabel']
    when 'commands.request' then array['bindingId','type','args'] when 'commands.claim' then array['limit'] when 'commands.report' then array['commandId','claimNonce','status','reason'] end;
  if not public.apply_pipeline_keys(p_args,v_allowed) then raise exception 'invalid args' using errcode='22023'; end if;
  if p_args ? 'limit' then
    if coalesce(p_args->>'limit','') !~ '^[0-9]+$' or (p_args->>'limit')::numeric not between 1 and 200 then raise exception 'invalid limit' using errcode='22023'; end if;
    v_limit:=(p_args->>'limit')::integer;
  end if;
  if p_args ? 'leaseSeconds' then
    if coalesce(p_args->>'leaseSeconds','') !~ '^[0-9]+$' or (p_args->>'leaseSeconds')::numeric not between 30 and 300 then raise exception 'invalid lease' using errcode='22023'; end if;
    v_seconds:=(p_args->>'leaseSeconds')::integer;
  end if;
  /* Lock target binding before owner state, matching the service dispatcher. */
  if p_action in ('run.request','commands.request') then
    select * into v_binding from public.apply_agent_bindings where id=(p_args->>'bindingId')::uuid and user_id=p_user and revoked_at is null for update;
    if not found then raise exception 'binding not found' using errcode='P0002'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,6111404));
  v_now:=clock_timestamp();
  if not public.service_apply_agent_has_access(p_user) and not (p_binding is null and p_action=any(array['profile.get','settings.get','settings.put','answers.list','answers.revoke','questions.list','boards.list','run.list','run.cancel','tasks.list','agent.list','sessions.list','commands.request']) or p_binding is not null and p_action='submission.finish') then raise exception 'not entitled' using errcode='42501'; end if;
  select * into v_profile from public.apply_verified_profiles where user_id=p_user for update;
  select * into v_settings from public.apply_pipeline_settings where user_id=p_user for update;

  /* The owner has already explicitly selected this binding once. Future scans
     are bounded and retain that selection, never enabling another machine. */
  if p_action='tasks.claim' and v_profile.user_id is not null and v_settings.data->>'enabled'='true'
    and not exists(select 1 from public.apply_binding_state where binding_id=p_binding and status<>'ready')
    and exists(select 1 from public.apply_runs where user_id=p_user and binding_id=p_binding)
    and not exists(select 1 from public.apply_runs where user_id=p_user and binding_id=p_binding and created_at>v_now-interval '15 minutes')
    and not exists(select 1 from public.apply_tasks where user_id=p_user and target_binding_id=p_binding and status in ('queued','in_progress','submitting')) then
    v_result:=public.apply_pipeline_action(p_user,null,'run.request',jsonb_build_object('bindingId',p_binding,'limit',100,
      'mode',case when v_settings.data->>'autoSubmit'='true' and v_profile.resume_approved then 'auto' else 'review' end));
  end if;

  case p_action
  when 'profile.get' then return jsonb_build_object('profile',case when v_profile.user_id is null then null else to_jsonb(v_profile)-'user_id' end);
  when 'settings.get' then
    if v_settings.user_id is null then insert into public.apply_pipeline_settings(user_id) values(p_user) returning * into v_settings; end if;
    return jsonb_build_object('settings',to_jsonb(v_settings)-'user_id');
  when 'profile.confirm' then
    if not p_args ? 'expectedRevision' or jsonb_typeof(p_args->'facts') is distinct from 'object' or (select count(*) from jsonb_object_keys(p_args->'facts'))>100
      or jsonb_typeof(p_args->'resumeText') is distinct from 'string' or char_length(p_args->>'resumeText')>12000 or jsonb_typeof(p_args->'resumeApproved') is distinct from 'boolean' then raise exception 'invalid profile' using errcode='22023'; end if;
    v_expected:=(p_args->>'expectedRevision')::integer;
    if v_expected is distinct from v_profile.revision then raise exception 'revision conflict' using errcode='40001'; end if;
    for v_key,v_value in select * from jsonb_each(p_args->'facts') loop
      if (v_key !~ '^[A-Za-z][A-Za-z0-9_.-]{0,79}$' and v_key !~ '^skillYears:[a-z0-9+#. /-]{1,80}$' and v_key !~ '^(portalProfileApproved|portalAccountIdentity|portalResumeText):[a-z][a-z0-9_-]{0,39}$') or not public.apply_pipeline_keys(v_value,array['value','source','confirmedAt','scope','validUntil'])
        or v_value->>'source' is distinct from 'user' or not v_value ? 'value' or not (jsonb_typeof(v_value->'value') in ('string','number','boolean') or public.apply_pipeline_strings(v_value->'value',100,200))
        or char_length(v_value->>'value')>(case when v_key ~ '^portalResumeText:' then 12000 else 10000 end) then raise exception 'invalid fact' using errcode='22023'; end if;
      if v_key ~ '^skillYears:' and (jsonb_typeof(v_value->'value')<>'number' or (v_value->>'value')::numeric not between 0 and 100) then raise exception 'invalid skill years' using errcode='22023'; end if;
      if v_key ~ '^(portalProfileApproved|portalAccountIdentity|portalResumeText):' then
        if coalesce(v_value->'scope'->>'portal','')='' or v_key ~ '^portalProfileApproved:' and jsonb_typeof(v_value->'value')<>'boolean'
          or v_key ~ '^(portalAccountIdentity|portalResumeText):' and (jsonb_typeof(v_value->'value')<>'string' or btrim(v_value->>'value')='')
          or v_key ~ '^portalAccountIdentity:' and char_length(v_value->>'value')>500 then raise exception 'invalid explicit portal approval' using errcode='22023'; end if;
      end if;
      if v_value ? 'scope' then
        if not public.apply_pipeline_keys(v_value->'scope',array['country','employer','portal','application']) or exists(select 1 from jsonb_each(v_value->'scope') s where jsonb_typeof(s.value)<>'string' or char_length(s.value#>>'{}') not between 1 and 500) then raise exception 'invalid fact scope' using errcode='22023'; end if;
      end if;
      if v_key in ('workAuthorization','work_authorization','requiresSponsorship','requires_sponsorship','sponsorship') and coalesce(v_value->'scope'->>'country','')='' then raise exception 'country scope required' using errcode='22023'; end if;
      if v_value ? 'validUntil' and ((v_value->>'validUntil')::timestamptz is null or (v_value->>'validUntil')::timestamptz<=v_now) then raise exception 'invalid fact expiry' using errcode='22023'; end if;
      v_facts:=v_facts||jsonb_build_object(v_key,(v_value-'confirmedAt')||jsonb_build_object('source','user','confirmedAt',to_char(v_now at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
    end loop;
    if p_args->>'resumeApproved'='true' and btrim(p_args->>'resumeText')='' then raise exception 'approved resume required' using errcode='22023'; end if;
    insert into public.apply_verified_profiles(user_id,revision,answers_revision,facts,resume_text,resume_approved,confirmed_at,updated_at)
      values(p_user,1,1,v_facts,p_args->>'resumeText',(p_args->>'resumeApproved')::boolean,v_now,v_now)
      on conflict(user_id) do update set revision=apply_verified_profiles.revision+1,answers_revision=apply_verified_profiles.answers_revision+1,
        facts=excluded.facts,resume_text=excluded.resume_text,resume_approved=excluded.resume_approved,confirmed_at=v_now,updated_at=v_now returning * into v_profile;
    update public.apply_verified_answers set revoked_at=v_now,revoke_reason='profile_changed' where user_id=p_user and revoked_at is null;
    update public.apply_question_inbox set status='dismissed',updated_at=v_now where user_id=p_user and status='pending';
    perform public.apply_pipeline_invalidate(p_user,'profile_changed');
    return jsonb_build_object('profile',to_jsonb(v_profile)-'user_id');
  when 'settings.put' then
    if not p_args ? 'expectedRevision' or not public.apply_pipeline_validate_settings(p_args->'settings') then raise exception 'invalid settings' using errcode='22023'; end if;
    if not public.service_apply_agent_has_access(p_user) and (p_args->'settings'->>'enabled'='true' or p_args->'settings'->>'autoSubmit'='true') then raise exception 'not entitled' using errcode='42501'; end if;
    v_expected:=(p_args->>'expectedRevision')::integer;
    if v_expected is distinct from v_settings.revision then raise exception 'revision conflict' using errcode='40001'; end if;
    insert into public.apply_pipeline_settings(user_id,data) values(p_user,p_args->'settings') on conflict(user_id) do update
      set revision=apply_pipeline_settings.revision+1,data=excluded.data,updated_at=v_now returning * into v_settings;
    perform public.apply_pipeline_invalidate(p_user,'settings_changed');
    return jsonb_build_object('settings',to_jsonb(v_settings)-'user_id');
  when 'answers.list' then
    if p_args ? 'includeRevoked' and jsonb_typeof(p_args->'includeRevoked')<>'boolean' or p_binding is not null and p_args->>'includeRevoked'='true' then raise exception 'invalid args' using errcode='22023'; end if;
    select coalesce(jsonb_agg(row),'[]') into v_result from (select to_jsonb(a)-'user_id' row from public.apply_verified_answers a where a.user_id=p_user
      and (p_binding is null and p_args->>'includeRevoked'='true' or a.revoked_at is null and (a.expires_at is null or a.expires_at>v_now) and a.profile_revision=v_profile.revision)
      order by a.confirmed_at desc,a.id limit v_limit) s;
    return jsonb_build_object('answers',v_result,'revision',coalesce(v_profile.answers_revision,0));
  when 'answers.revoke' then
    update public.apply_verified_answers set revoked_at=coalesce(revoked_at,v_now),revoke_reason='user_revoked' where id=(p_args->>'answerId')::uuid and user_id=p_user returning * into v_answer;
    if not found then raise exception 'answer not found' using errcode='P0002'; end if;
    update public.apply_verified_profiles set answers_revision=answers_revision+1,updated_at=v_now where user_id=p_user;
    perform public.apply_pipeline_invalidate(p_user,'answer_revoked');
    return jsonb_build_object('answer',to_jsonb(v_answer)-'user_id');
  when 'questions.list' then
    if p_args ? 'status' and coalesce(p_args->>'status','') not in ('pending','answered','dismissed') then raise exception 'invalid status' using errcode='22023'; end if;
    select coalesce(jsonb_agg(row),'[]') into v_result from (select to_jsonb(q)-'user_id'||jsonb_build_object('task_ids',coalesce((select jsonb_agg(qt.task_id order by qt.task_id) from public.apply_question_tasks qt where qt.question_id=q.id),'[]'::jsonb)) row from public.apply_question_inbox q where q.user_id=p_user and q.status=coalesce(p_args->>'status','pending') order by q.created_at,q.id limit v_limit) s;
    return jsonb_build_object('questions',v_result);
  when 'questions.answer' then
    select * into v_question from public.apply_question_inbox where id=(p_args->>'questionId')::uuid and user_id=p_user for update;
    if not found then raise exception 'question not found' using errcode='P0002'; end if;
    if v_question.status<>'pending' or v_question.profile_revision is distinct from v_profile.revision then raise exception 'revision conflict' using errcode='40001'; end if;
    if p_args->'confirm' is distinct from 'true'::jsonb or jsonb_typeof(p_args->'answer') is distinct from 'string' or char_length(p_args->>'answer') not between 1 and 12000 then raise exception 'explicit answer confirmation required' using errcode='22023'; end if;
    v_scope:=p_args->>'scope'; v_scope_key:=coalesce(p_args->>'scopeKey','');
    if v_scope is null or v_scope not in ('global','country','employer','portal','application') or v_scope='global' and v_scope_key<>'' or v_scope<>'global' and char_length(v_scope_key) not between 1 and 500 then raise exception 'invalid answer scope' using errcode='22023'; end if;
    /* An unknown or legal/currency-sensitive question cannot be promoted to a
       broader answer by accident. The UI must use its explicit queued scope. */
    if v_scope is distinct from v_question.scope or v_scope_key is distinct from v_question.scope_key then raise exception 'question scope mismatch' using errcode='22023'; end if;
    if v_question.control_type in ('select','radio') and not v_question.options ? (p_args->>'answer') then raise exception 'answer must match offered option' using errcode='22023'; end if;
    v_expiry:=(p_args->>'expiresAt')::timestamptz;
    if p_args ? 'expiresAt' and (v_expiry is null or v_expiry<=v_now) then raise exception 'invalid answer expiry' using errcode='22023'; end if;
    update public.apply_verified_answers set revoked_at=v_now,revoke_reason='answer_replaced' where user_id=p_user and question_key=v_question.question_key and scope=v_scope and scope_key=v_scope_key and revoked_at is null;
    insert into public.apply_verified_answers(user_id,question_key,meaning,question_text,control_type,options,context,answer,scope,scope_key,profile_revision,expires_at)
      values(p_user,v_question.question_key,v_question.meaning,v_question.question_text,v_question.control_type,v_question.options,v_question.context,p_args->>'answer',v_scope,v_scope_key,v_profile.revision,v_expiry) returning * into v_answer;
    update public.apply_question_inbox set status='answered',answer_id=v_answer.id,updated_at=v_now where id=v_question.id;
    update public.apply_verified_profiles set answers_revision=answers_revision+1,updated_at=v_now where user_id=p_user returning * into v_profile;
    /* A bank revision affects every pre-submit plan, not only question-linked
       tasks. Fence old workers and let fresh claims recheck the complete bank. */
    update public.apply_tasks t set
      status=case when t.status='waiting_login' then 'waiting_login'
        when exists(select 1 from public.apply_question_tasks qt join public.apply_question_inbox q on q.id=qt.question_id where qt.task_id=t.id and q.status='pending') then 'waiting_answer' else 'queued' end,
      answers_revision=v_profile.answers_revision,
      reason=case when t.status='waiting_login' then t.reason else null end,
      lease_version=t.lease_version+1,lease_until=null,lease_nonce=null,claimed_by=null,updated_at=v_now
      where t.user_id=p_user and t.profile_revision=v_profile.revision and t.settings_revision=v_settings.revision
      and (t.status in ('queued','in_progress','waiting_answer','waiting_login')
        or t.status='waiting_review' and (t.reason='revision_changed'
          or exists(select 1 from public.apply_question_tasks qt where qt.task_id=t.id and qt.question_id=v_question.id)
            and coalesce(t.reason,'') !~* '(linkedin|portal requires|submission policy|agent_paused|profile_changed|settings_changed|answer_revoked)'))
      and exists(select 1 from public.apply_runs r where r.id=t.run_id and r.status<>'cancelled')
      and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id);
    return jsonb_build_object('answer',to_jsonb(v_answer)-'user_id','revision',v_profile.answers_revision);
  when 'boards.list' then
    select coalesce(jsonb_agg(row),'[]') into v_result from (select to_jsonb(b)-'user_id' row from public.apply_discovered_boards b where b.user_id=p_user order by b.created_at,b.id limit v_limit) s;
    return jsonb_build_object('boards',v_result);
  when 'boards.add', 'boards.discover' then
    if not public.apply_pipeline_public_url(p_args->>'url') or p_args ? 'type' and coalesce(p_args->>'type','') not in ('manual','greenhouse','lever','ashby','workday') then raise exception 'invalid board' using errcode='22023'; end if;
    if p_args ? 'label' and (jsonb_typeof(p_args->'label')<>'string' or char_length(p_args->>'label') not between 1 and 200) then raise exception 'invalid label' using errcode='22023'; end if;
    insert into public.apply_discovered_boards(user_id,url,host,label,type) values(p_user,p_args->>'url',public.apply_pipeline_host(p_args->>'url'),coalesce(p_args->>'label',public.apply_pipeline_host(p_args->>'url')),coalesce(p_args->>'type','manual'))
      on conflict(user_id,url) do update set label=excluded.label,updated_at=v_now returning * into v_board;
    return jsonb_build_object('board',to_jsonb(v_board)-'user_id');
  when 'jobs.list' then
    if p_args ? 'offset' and (coalesce(p_args->>'offset','') !~ '^[0-9]+$' or (p_args->>'offset')::numeric>100000) then raise exception 'invalid offset' using errcode='22023'; end if;
    return jsonb_build_object('jobs',public.apply_pipeline_jobs(p_user,coalesce((p_args->>'offset')::integer,0),v_limit),'publicFeedAvailable',to_regclass('public.jobs') is not null);
  when 'jobs.ingest' then
    select * into v_board from public.apply_discovered_boards where id=(p_args->>'boardId')::uuid and user_id=p_user and status='pending';
    if not found then raise exception 'board not found' using errcode='P0002'; end if;
    if jsonb_typeof(p_args->'jobs') is distinct from 'array' or jsonb_array_length(p_args->'jobs')>100 then raise exception 'invalid jobs' using errcode='22023'; end if;
    for v_item in select * from jsonb_array_elements(p_args->'jobs') loop
      if not public.apply_pipeline_validate_job(v_item) or public.apply_pipeline_host(v_item->>'jobUrl')<>v_board.host then raise exception 'invalid private job' using errcode='22023'; end if;
      insert into public.apply_discovered_jobs(user_id,board_id,job_key,job) values(p_user,v_board.id,public.apply_pipeline_job_key(v_item->>'jobUrl'),v_item)
        on conflict(user_id,job_key) do update set job=excluded.job,updated_at=v_now;
      v_count:=v_count+1;
    end loop;
    return jsonb_build_object('ingested',v_count);
  when 'run.request' then
    v_limit:=least(v_limit,100); v_mode:=coalesce(p_args->>'mode','review');
    if v_mode not in ('review','auto') or v_settings.user_id is null or v_settings.data->>'enabled'<>'true' or v_profile.user_id is null then raise exception 'confirmed profile and enabled settings required' using errcode='22023'; end if;
    if v_mode='auto' and (v_settings.data->>'autoSubmit'<>'true' or not v_profile.resume_approved) then raise exception 'explicit auto-submit and approved resume required' using errcode='22023'; end if;
    insert into public.apply_runs(user_id,binding_id,mode,profile_revision,settings_revision,answers_revision)
      values(p_user,v_binding.id,v_mode,v_profile.revision,v_settings.revision,v_profile.answers_revision) returning * into v_run;
    for v_item in select * from jsonb_array_elements(public.apply_pipeline_jobs(p_user,0,least(v_limit*5,500))) loop
      v_candidates:=v_candidates+1;
      if not public.apply_pipeline_validate_job(v_item) then continue; end if;
      v_match:=public.apply_pipeline_match(v_profile.facts,v_settings.data,v_item,v_now);
      /* Keep filter verdicts visible rather than claiming AI-ranked authority. */
      insert into public.apply_tasks(user_id,run_id,target_binding_id,job_key,job,status,score,reason,profile_revision,settings_revision,answers_revision)
        values(p_user,v_run.id,v_binding.id,public.apply_pipeline_job_key(v_item->>'jobUrl'),v_item,
          case when v_match->>'reason' is null then 'queued' else 'filtered' end,(v_match->>'score')::integer,v_match->>'reason',v_profile.revision,v_settings.revision,v_profile.answers_revision)
        on conflict(user_id,job_key) do update set run_id=excluded.run_id,target_binding_id=excluded.target_binding_id,job=excluded.job,status=excluded.status,score=excluded.score,reason=excluded.reason,
          profile_revision=excluded.profile_revision,settings_revision=excluded.settings_revision,answers_revision=excluded.answers_revision,
          lease_version=apply_tasks.lease_version+1,lease_until=null,lease_nonce=null,claimed_by=null,updated_at=v_now
        where apply_tasks.status in ('filtered','waiting_review','waiting_answer','waiting_login','failed','cancelled','unsupported')
          and not exists(select 1 from public.apply_submission_reservations r where r.task_id=apply_tasks.id) returning id into v_id;
      if found then v_count:=v_count+1; end if;
      exit when v_count>=v_limit;
    end loop;
    update public.apply_runs set candidate_count=v_candidates,task_count=v_count where id=v_run.id returning * into v_run;
    perform public.apply_pipeline_refresh_run(v_run.id);
    select * into v_run from public.apply_runs where id=v_run.id;
    return jsonb_build_object('run',to_jsonb(v_run)-'user_id','publicFeedAvailable',to_regclass('public.jobs') is not null);
  when 'run.list' then
    select coalesce(jsonb_agg(row),'[]') into v_result from (select to_jsonb(r)-'user_id' row from public.apply_runs r where r.user_id=p_user order by r.created_at desc,r.id limit v_limit) s;
    return jsonb_build_object('runs',v_result);
  when 'run.cancel' then
    update public.apply_runs set status='cancelled',finished_at=v_now where id=(p_args->>'runId')::uuid and user_id=p_user returning * into v_run;
    if not found then raise exception 'run not found' using errcode='P0002'; end if;
    update public.apply_tasks set status=case when status='submitting' then 'unverified' else 'cancelled' end,reason='run_cancelled',
      lease_until=null,lease_nonce=case when status='submitting' then lease_nonce else null end,
      lease_version=case when status='submitting' then lease_version else lease_version+1 end,updated_at=v_now
      where run_id=v_run.id and status in ('queued','in_progress','submitting','waiting_answer','waiting_login','waiting_review');
    update public.apply_submission_reservations r set status='unverified',finished_at=v_now where r.task_id in (select id from public.apply_tasks where run_id=v_run.id) and r.status='reserved';
    return jsonb_build_object('run',to_jsonb(v_run)-'user_id');
  when 'tasks.list' then
    /* Owners can reconcile crashed attempts even when every binding has expired
       or been revoked. This only marks uncertainty; it never renews/requeues. */
    update public.apply_tasks set status='unverified',reason='submission_lease_expired',lease_until=null,updated_at=v_now
      where user_id=p_user and status='submitting' and lease_until<=v_now;
    update public.apply_submission_reservations r set status='unverified',finished_at=v_now
      where r.user_id=p_user and r.status='reserved' and exists(select 1 from public.apply_tasks t where t.id=r.task_id and t.status='unverified');
    select coalesce(jsonb_agg(row),'[]') into v_result from (select to_jsonb(t)-'user_id'-'lease_nonce' row from public.apply_tasks t where t.user_id=p_user and (not p_args ? 'runId' or t.run_id=(p_args->>'runId')::uuid) order by t.created_at desc,t.id limit v_limit) s;
    return jsonb_build_object('tasks',v_result);
  when 'tasks.claim' then
    v_limit:=least(v_limit,10);
    /* An attempt that might already have crossed submit is NEVER replayed. */
    update public.apply_tasks set status='unverified',reason='submission_lease_expired',lease_until=null,updated_at=v_now where user_id=p_user and status='submitting' and lease_until<=v_now;
    update public.apply_submission_reservations r set status='unverified',finished_at=v_now where r.user_id=p_user and r.status='reserved' and exists(select 1 from public.apply_tasks t where t.id=r.task_id and t.status='unverified');
    if v_settings.data->>'enabled' is distinct from 'true' or exists(select 1 from public.apply_binding_state where binding_id=p_binding and status<>'ready') then return jsonb_build_object('tasks','[]'::jsonb); end if;
    update public.apply_tasks set status='waiting_review',reason='revision_changed',lease_nonce=null,lease_until=null,lease_version=lease_version+1,updated_at=v_now
      where user_id=p_user and target_binding_id=p_binding and status in ('queued','in_progress')
      and (profile_revision<>v_profile.revision or settings_revision<>v_settings.revision or answers_revision<>v_profile.answers_revision);
    with candidates as (
      select t.id from public.apply_tasks t join public.apply_runs r on r.id=t.run_id
      where t.user_id=p_user and t.target_binding_id=p_binding and r.status<>'cancelled'
        and (t.status='queued' or t.status='in_progress' and t.lease_until<=v_now)
        and not exists(select 1 from public.apply_submission_reservations s where s.task_id=t.id)
      order by t.score desc,t.created_at,t.id for update of t skip locked limit v_limit
    ), claimed as (
      update public.apply_tasks t set status='in_progress',lease_version=lease_version+1,lease_nonce=gen_random_uuid(),lease_until=v_now+make_interval(secs=>v_seconds),claimed_by=p_binding,updated_at=v_now
      from candidates c where t.id=c.id returning t.*)
    select coalesce(jsonb_agg(to_jsonb(c)-'user_id'),'[]') into v_result from claimed c;
    update public.apply_runs set status='running',started_at=coalesce(started_at,v_now) where id in(select (x->>'run_id')::uuid from jsonb_array_elements(v_result) x) and status='queued';
    return jsonb_build_object('tasks',v_result);
  when 'agent.list' then
    select coalesce(jsonb_agg(row),'[]') into v_result from (select jsonb_build_object('binding_id',b.id,'label',b.label,'revoked_at',b.revoked_at,'last_used_at',b.last_used_at,
      'engine_version',s.engine_version,'capabilities',coalesce(s.capabilities,'[]'::jsonb),'status',s.status,
      'profile_metadata',coalesce(s.profile_metadata,'{}'::jsonb),'heartbeat_at',s.heartbeat_at) row from public.apply_agent_bindings b left join public.apply_binding_state s on s.binding_id=b.id
      where b.user_id=p_user order by b.created_at desc,b.id limit v_limit) q;
    return jsonb_build_object('agents',v_result);
  when 'agent.heartbeat' then
    if jsonb_typeof(p_args->'engineVersion') is distinct from 'string' or char_length(p_args->>'engineVersion') not between 1 and 100
      or not public.apply_pipeline_strings(p_args->'capabilities',50,100) or coalesce(p_args->>'status','') not in ('ready','paused','offline')
      or p_args ? 'profileMetadata' and not public.apply_pipeline_keys(p_args->'profileMetadata',array['revision','resumeApproved']) then raise exception 'invalid heartbeat' using errcode='22023'; end if;
    if p_args->'profileMetadata' ? 'resumeApproved' and jsonb_typeof(p_args->'profileMetadata'->'resumeApproved')<>'boolean'
      or p_args->'profileMetadata' ? 'revision' and coalesce(p_args->'profileMetadata'->>'revision','') !~ '^[0-9]+$' then raise exception 'invalid metadata' using errcode='22023'; end if;
    insert into public.apply_binding_state(binding_id,user_id,engine_version,capabilities,status,profile_metadata,heartbeat_at)
      values(p_binding,p_user,p_args->>'engineVersion',p_args->'capabilities',p_args->>'status',coalesce(p_args->'profileMetadata','{}'),v_now)
      on conflict(binding_id) do update set engine_version=excluded.engine_version,capabilities=excluded.capabilities,status=case when apply_binding_state.control_paused then 'paused' else excluded.status end,profile_metadata=excluded.profile_metadata,heartbeat_at=v_now;
    return jsonb_build_object('heartbeatAt',v_now);
  when 'sessions.list' then
    select coalesce(jsonb_agg(row),'[]') into v_result from (select to_jsonb(s)-'user_id' row from public.apply_binding_sessions s where s.user_id=p_user order by s.checked_at desc,s.portal limit v_limit) q;
    return jsonb_build_object('sessions',v_result);
  when 'sessions.report' then
    if jsonb_typeof(p_args->'portal') is distinct from 'string' or char_length(p_args->>'portal') not between 1 and 200 or coalesce(p_args->>'status','') not in ('authenticated','expired','login_required','unsupported')
      or p_args ? 'accountLabel' and (jsonb_typeof(p_args->'accountLabel')<>'string' or char_length(p_args->>'accountLabel') not between 1 and 200) then raise exception 'invalid session metadata' using errcode='22023'; end if;
    insert into public.apply_binding_sessions(binding_id,user_id,portal,status,account_label,checked_at) values(p_binding,p_user,p_args->>'portal',p_args->>'status',p_args->>'accountLabel',v_now)
      on conflict(binding_id,portal) do update set status=excluded.status,account_label=excluded.account_label,checked_at=v_now;
    if p_args->>'status'='authenticated' then
      update public.apply_tasks t set status=case when exists(select 1 from public.apply_question_tasks qt join public.apply_question_inbox q on q.id=qt.question_id where qt.task_id=t.id and q.status='pending') then 'waiting_answer' else 'queued' end,
        reason=null,lease_until=null,lease_nonce=null,claimed_by=null,lease_version=lease_version+1,updated_at=v_now
        where t.user_id=p_user and t.target_binding_id=p_binding and t.status='waiting_login'
        and public.apply_pipeline_command_portal(t.job,p_args->>'portal')
        and t.profile_revision=v_profile.revision and t.settings_revision=v_settings.revision and t.answers_revision=v_profile.answers_revision
        and exists(select 1 from public.apply_runs r where r.id=t.run_id and r.status<>'cancelled')
        and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id);
    end if;
    return jsonb_build_object('reported',true);
  when 'commands.request' then
    if coalesce(p_args->>'type','') not in ('pause','resume','retry_login','open_question','check_session')
      or p_args ? 'args' and not public.apply_pipeline_keys(p_args->'args',array['portal','questionId']) then raise exception 'invalid command' using errcode='22023'; end if;
    v_item:=coalesce(p_args->'args','{}');
    if p_args->>'type' in ('pause','resume') and v_item<>'{}'::jsonb
      or p_args->>'type' in ('retry_login','check_session') and (not public.apply_pipeline_keys(v_item,array['portal'])
        or jsonb_typeof(v_item->'portal') is distinct from 'string' or char_length(btrim(v_item->>'portal')) not between 1 and 200)
      or p_args->>'type'='open_question' and (not public.apply_pipeline_keys(v_item,array['questionId'])
        or jsonb_typeof(v_item->'questionId') is distinct from 'string' or coalesce(v_item->>'questionId','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') then raise exception 'invalid command args' using errcode='22023'; end if;
    if not public.service_apply_agent_has_access(p_user) and p_args->>'type'<>'pause' then raise exception 'not entitled' using errcode='42501'; end if;
    v_id:=null;
    if p_args->>'type' in ('retry_login','open_question','check_session') then
      select t.id into v_id from public.apply_tasks t join public.apply_runs r on r.id=t.run_id and r.user_id=p_user
        where t.user_id=p_user and t.target_binding_id=v_binding.id and r.status<>'cancelled'
          and t.status in ('queued','waiting_login','waiting_answer','waiting_review')
          and not exists(select 1 from public.apply_submission_reservations s where s.task_id=t.id)
          and public.apply_pipeline_validate_job(t.job) and (
            p_args->>'type' in ('retry_login','check_session') and public.apply_pipeline_command_portal(t.job,v_item->>'portal')
            or p_args->>'type'='open_question' and exists(select 1 from public.apply_question_tasks qt join public.apply_question_inbox q on q.id=qt.question_id and q.user_id=p_user
              where qt.user_id=p_user and qt.task_id=t.id and q.id=(v_item->>'questionId')::uuid and q.status='pending'
                and q.profile_revision=t.profile_revision and qt.job_context=public.apply_pipeline_job_context(t.job)))
        order by case when t.status='waiting_login' then 0 else 1 end,t.created_at,t.id limit 1;
      if v_id is null then raise exception 'command target not found' using errcode='P0002'; end if;
    end if;
    insert into public.apply_binding_commands(binding_id,user_id,type,args,task_id) values(v_binding.id,p_user,p_args->>'type',v_item,v_id) returning * into v_command;
    /* Pause takes effect in SQL immediately even if the worker is asleep. */
    if v_command.type in ('pause','resume') then
      update public.apply_binding_commands set status='cancelled',finished_at=v_now where user_id=p_user and binding_id=v_binding.id
        and type in ('pause','resume') and status in ('queued','claimed') and id<>v_command.id;
      insert into public.apply_binding_state(binding_id,user_id,engine_version,capabilities,status,control_paused)
        values(v_binding.id,p_user,'not_connected','[]',case when v_command.type='pause' then 'paused' else 'ready' end,v_command.type='pause')
        on conflict(binding_id) do update set control_paused=excluded.control_paused,status=excluded.status;
      if v_command.type='pause' then
        update public.apply_tasks set status=case when status in ('queued','in_progress') then 'waiting_review' else status end,
          reason=case when status in ('queued','in_progress') then 'agent_paused' else reason end,
          lease_until=null,lease_nonce=null,claimed_by=null,lease_version=lease_version+1,updated_at=v_now
          where user_id=p_user and target_binding_id=v_binding.id and status in ('queued','in_progress','waiting_answer','waiting_login','waiting_review')
            and not exists(select 1 from public.apply_submission_reservations r where r.task_id=apply_tasks.id);
      else
        update public.apply_tasks t set status=case when exists(select 1 from public.apply_question_tasks qt join public.apply_question_inbox q on q.id=qt.question_id where qt.task_id=t.id and q.status='pending') then 'waiting_answer' else 'queued' end,
          reason=null,updated_at=v_now where t.user_id=p_user and t.target_binding_id=v_binding.id and t.status='waiting_review' and t.reason='agent_paused'
          and t.profile_revision=v_profile.revision and t.settings_revision=v_settings.revision and t.answers_revision=v_profile.answers_revision
          and exists(select 1 from public.apply_runs r where r.id=t.run_id and r.status<>'cancelled')
          and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id);
      end if;
    end if;
    return jsonb_build_object('command',to_jsonb(v_command)-'user_id');
  when 'commands.claim' then
    v_result:='[]';
    for v_command in select * from public.apply_binding_commands where user_id=p_user and binding_id=p_binding
      and (status='queued' or status='claimed' and (claimed_at is null or claimed_at<=v_now-interval '5 minutes'))
      order by created_at,id for update skip locked limit least(v_limit,20) loop
      v_item:='{}';
      if v_command.type in ('retry_login','open_question','check_session') then
        select * into v_task from public.apply_tasks t where t.id=v_command.task_id and t.user_id=p_user and t.target_binding_id=p_binding
          and t.status in ('queued','waiting_login','waiting_answer','waiting_review') and public.apply_pipeline_validate_job(t.job)
          and exists(select 1 from public.apply_runs r where r.id=t.run_id and r.user_id=p_user and r.status<>'cancelled')
          and not exists(select 1 from public.apply_submission_reservations s where s.task_id=t.id);
        if not found then
          update public.apply_binding_commands set status='failed',reason='Command target no longer available',finished_at=v_now where id=v_command.id; continue;
        end if;
        if v_command.type='open_question' then
          select q.* into v_question from public.apply_question_inbox q join public.apply_question_tasks qt on qt.question_id=q.id
            where q.id=(v_command.args->>'questionId')::uuid and q.user_id=p_user and q.status='pending'
              and qt.user_id=p_user and qt.task_id=v_task.id and qt.job_context=public.apply_pipeline_job_context(v_task.job)
              and q.profile_revision=v_task.profile_revision;
          if not found then
            update public.apply_binding_commands set status='failed',reason='Pending question no longer available',finished_at=v_now where id=v_command.id; continue;
          end if;
          v_item:=jsonb_build_object('question',to_jsonb(v_question)-'user_id'||jsonb_build_object('task_ids',jsonb_build_array(v_task.id)));
        elsif not public.apply_pipeline_command_portal(v_task.job,v_command.args->>'portal') then
          update public.apply_binding_commands set status='failed',reason='Command portal mismatch',finished_at=v_now where id=v_command.id; continue;
        end if;
        v_item:=v_item||jsonb_build_object('job',v_task.job);
      end if;
      update public.apply_binding_commands set status='claimed',claimed_at=v_now,claim_nonce=gen_random_uuid() where id=v_command.id returning * into v_command;
      v_result:=v_result||jsonb_build_array(to_jsonb(v_command)-'user_id'||v_item);
    end loop;
    return jsonb_build_object('commands',v_result);
  when 'commands.report' then
    if coalesce(p_args->>'status','') not in ('done','failed') or jsonb_typeof(p_args->'claimNonce') is distinct from 'string'
      or coalesce(p_args->>'claimNonce','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      or p_args ? 'reason' and (jsonb_typeof(p_args->'reason')<>'string' or char_length(p_args->>'reason')>2000) then raise exception 'invalid command report' using errcode='22023'; end if;
    update public.apply_binding_commands set status=p_args->>'status',reason=p_args->>'reason',finished_at=v_now where id=(p_args->>'commandId')::uuid and user_id=p_user and binding_id=p_binding
      and status='claimed' and claim_nonce=(p_args->>'claimNonce')::uuid and claimed_at>v_now-interval '5 minutes' returning * into v_command;
    if not found then raise exception 'command not found' using errcode='P0002'; end if;
    /* Only the worker's transient human-window wait is retried; the command's
       original manual-review task and all policy waits remain untouched. */
    if v_command.status='done' and v_command.type in ('check_session','open_question') then
      select job into v_item from public.apply_tasks where id=v_command.task_id and user_id=p_user and target_binding_id=p_binding;
      update public.apply_tasks t set status=case when exists(select 1 from public.apply_question_tasks qt join public.apply_question_inbox q on q.id=qt.question_id where qt.task_id=t.id and q.status='pending') then 'waiting_answer' else 'queued' end,
        reason=null,lease_until=null,lease_nonce=null,claimed_by=null,lease_version=lease_version+1,updated_at=v_now
        where t.user_id=p_user and t.target_binding_id=p_binding and t.id<>v_command.task_id
          and t.status='waiting_review' and t.reason='Human window owns this portal; retry after it closes'
          and public.apply_pipeline_auto_site(t.job) is not distinct from public.apply_pipeline_auto_site(v_item)
          and public.apply_pipeline_auto_site(v_item) is not null
          and t.profile_revision=v_profile.revision and t.settings_revision=v_settings.revision and t.answers_revision=v_profile.answers_revision
          and not exists(select 1 from public.apply_binding_state where binding_id=p_binding and control_paused)
          and exists(select 1 from public.apply_runs r where r.id=t.run_id and r.status<>'cancelled')
          and not exists(select 1 from public.apply_submission_reservations r where r.task_id=t.id);
    end if;
    return jsonb_build_object('command',to_jsonb(v_command)-'user_id');
  else
    /* All remaining operations require a fenced task owned by this binding. */
    select * into v_task from public.apply_tasks where id=(p_args->>'taskId')::uuid and user_id=p_user and target_binding_id=p_binding and claimed_by=p_binding for update;
    if not found then raise exception 'task not found' using errcode='P0002'; end if;
    if v_task.lease_version is distinct from (p_args->>'leaseVersion')::integer or v_task.lease_nonce is distinct from (p_args->>'leaseNonce')::uuid or v_task.lease_nonce is null then raise exception 'stale task lease' using errcode='40001'; end if;
    if p_action<>'submission.finish' and (v_task.status not in ('in_progress','submitting') or v_task.status='submitting' and p_action<>'tasks.renew' or v_task.lease_until is null or v_task.lease_until<=v_now) then raise exception 'stale task lease' using errcode='40001'; end if;
    if p_action<>'submission.finish' and (v_task.profile_revision<>v_profile.revision or v_task.settings_revision<>v_settings.revision or v_task.answers_revision<>v_profile.answers_revision) then raise exception 'revision conflict' using errcode='40001'; end if;
    case p_action
    when 'tasks.renew' then
      if exists(select 1 from public.apply_binding_state where binding_id=p_binding and control_paused) then raise exception 'agent paused' using errcode='42501'; end if;
      update public.apply_tasks set lease_until=v_now+make_interval(secs=>v_seconds),updated_at=v_now where id=v_task.id returning * into v_task;
      return jsonb_build_object('task',to_jsonb(v_task)-'user_id');
    when 'tasks.report' then
      if coalesce(p_args->>'status','') not in ('waiting_answer','waiting_login','waiting_review','unsupported','failed','filtered','unverified') or p_args ? 'reason' and (jsonb_typeof(p_args->'reason')<>'string' or char_length(p_args->>'reason')>2000) then raise exception 'invalid task status' using errcode='22023'; end if;
      if p_args->>'status'='waiting_answer' and not exists(select 1 from public.apply_question_tasks qt join public.apply_question_inbox q on q.id=qt.question_id where qt.task_id=v_task.id and q.status='pending') then raise exception 'pending question required' using errcode='22023'; end if;
      update public.apply_tasks set status=p_args->>'status',reason=p_args->>'reason',lease_until=null,lease_nonce=null,updated_at=v_now where id=v_task.id returning * into v_task;
      perform public.apply_pipeline_refresh_run(v_task.run_id);
      return jsonb_build_object('task',to_jsonb(v_task)-'user_id');
    when 'questions.queue' then
      v_item:=p_args->'question';
      if not public.apply_pipeline_keys(v_item,array['meaning','questionText','controlType','options','context','scope','scopeKey','questionKey','currency','reason','profileRevision'])
        or jsonb_typeof(v_item->'meaning') is distinct from 'string' or char_length(v_item->>'meaning') not between 1 and 200
        or jsonb_typeof(v_item->'questionText') is distinct from 'string' or char_length(v_item->>'questionText') not between 1 and 2000
        or coalesce(v_item->>'controlType','') not in ('text','textarea','select','radio','checkbox','number','date','email','tel','url') or not public.apply_pipeline_strings(v_item->'options',100,500)
        or not public.apply_pipeline_keys(v_item->'context',array['country','employer','portal','application','currency']) then raise exception 'invalid question' using errcode='22023'; end if;
      if exists(select 1 from jsonb_each(v_item->'context') x where jsonb_typeof(x.value)<>'string' or char_length(x.value#>>'{}') not between 1 and 500)
        or v_item->>'controlType' in ('select','radio') and jsonb_array_length(v_item->'options')=0 then raise exception 'invalid question context' using errcode='22023'; end if;
      v_context:=public.apply_pipeline_job_context(v_task.job); v_label:=public.apply_pipeline_question_label(v_item->>'questionText');
      v_known:=coalesce(v_label->>'meaning'=v_item->>'meaning',false);
      if v_label ? 'meaning' and not v_known then raise exception 'question meaning mismatch' using errcode='22023'; end if;
      if exists(select 1 from jsonb_each_text(v_item->'context') c where c.value is distinct from
        case when c.key in ('country','currency') then coalesce(v_label->>c.key,v_context->>c.key) else v_context->>c.key end) then raise exception 'question context mismatch' using errcode='22023'; end if;
      if v_label ? 'currency' and v_item->'context'->>'currency' is distinct from v_label->>'currency'
        or v_label ? 'country' and v_item->'context'->>'country' is distinct from v_label->>'country'
        or v_item ? 'currency' and v_item->>'currency' is distinct from v_item->'context'->>'currency' then raise exception 'explicit question context required' using errcode='22023'; end if;
      if v_item ? 'profileRevision' and (v_item->>'profileRevision')::integer<>v_profile.revision then raise exception 'revision conflict' using errcode='40001'; end if;
      v_scope:=coalesce(v_item->>'scope','application');
      v_scope_key:=coalesce(v_item->>'scopeKey',case when v_scope='application' then v_task.job->>'jobUrl' when v_scope='global' then '' else v_item->'context'->>v_scope end);
      if v_scope not in ('global','country','employer','portal','application') or v_scope='global' and coalesce(v_scope_key,'')<>'' or v_scope<>'global' and coalesce(v_scope_key,'')='' then raise exception 'invalid question scope' using errcode='22023'; end if;
      if v_scope<>'global' and v_scope_key is distinct from coalesce(v_item->'context'->>v_scope,case when v_scope='application' then v_task.job->>'jobUrl' else null end) then raise exception 'question scope mismatch' using errcode='22023'; end if;
      if not v_known and v_scope<>'application' then raise exception 'unknown question requires application scope' using errcode='22023'; end if;
      if v_known and (v_item->>'meaning' in ('workAuthorization','requiresSponsorship','currentSalary','expectedSalary') and
          (v_scope not in ('country','application') or v_scope='country' and not v_item->'context' ? 'country')
        or v_item->>'meaning'='relocation' and v_scope not in ('employer','application')) then raise exception 'sensitive question scope required' using errcode='22023'; end if;
      /* Sorted exact normalized options permit aliases/reordering, not similarity
         matches. Unknown labels and fresh attestations retain their exact text. */
      select coalesce(jsonb_agg(x order by x),'[]') into v_options from
        (select lower(regexp_replace(btrim(o),'\s+',' ','g')) x from jsonb_array_elements_text(v_item->'options') o) opts;
      if jsonb_array_length(v_options)<>(select count(distinct x) from jsonb_array_elements_text(v_options) x) then raise exception 'ambiguous question options' using errcode='22023'; end if;
      v_question_key:=md5(jsonb_build_array(v_item->>'meaning',case when v_known then '' else lower(regexp_replace(btrim(v_item->>'questionText'),'\s+',' ','g')) end,
        v_item->>'controlType',v_options,v_item->'context',v_scope,v_scope_key,v_item->'context'->>'currency')::text);
      select * into v_answer from public.apply_verified_answers where user_id=p_user and question_key=v_question_key
        and profile_revision=v_profile.revision and revoked_at is null and (expires_at is null or expires_at>v_now) order by confirmed_at desc,id limit 1;
      insert into public.apply_question_inbox(user_id,question_key,meaning,question_text,control_type,options,context,scope,scope_key,currency,reason,profile_revision,status,answer_id)
        values(p_user,v_question_key,v_item->>'meaning',v_item->>'questionText',v_item->>'controlType',v_item->'options',v_item->'context',v_scope,v_scope_key,v_item->'context'->>'currency',left(v_item->>'reason',1000),v_profile.revision,
          case when v_answer.id is null then 'pending' else 'answered' end,v_answer.id)
        on conflict(user_id,question_key) do update set status=excluded.status,answer_id=excluded.answer_id,profile_revision=excluded.profile_revision,updated_at=v_now returning * into v_question;
      insert into public.apply_question_tasks(user_id,question_id,task_id,job_context) values(p_user,v_question.id,v_task.id,v_context)
        on conflict(question_id,task_id) do update set job_context=excluded.job_context;
      return jsonb_build_object('question',to_jsonb(v_question)-'user_id');
    when 'submission.reserve' then
      if v_settings.data->>'enabled'<>'true' or v_settings.data->>'autoSubmit'<>'true' or not v_profile.resume_approved
        or not exists(select 1 from public.apply_runs where id=v_task.run_id and mode='auto' and status<>'cancelled') then raise exception 'explicit auto-submit required' using errcode='42501'; end if;
      if p_args->'siteAllowed' is distinct from 'true'::jsonb or p_args->'accountVerified' is distinct from 'true'::jsonb or p_args->'requiredComplete' is distinct from 'true'::jsonb then raise exception 'submit guards required' using errcode='22023'; end if;
      if (p_args->>'profileRevision')::integer is distinct from v_profile.revision or (p_args->>'settingsRevision')::integer is distinct from v_settings.revision or (p_args->>'answersRevision')::integer is distinct from v_profile.answers_revision then raise exception 'revision conflict' using errcode='40001'; end if;
      v_key:=public.apply_pipeline_host(v_task.job->>'jobUrl');
      /* This hard allowlist mirrors existing SITE_RULES. New/discovered portals
         do not gain auto-submit authority by saying siteAllowed=true. */
      if public.apply_pipeline_auto_site(v_task.job) is null then raise exception 'site policy forbids auto-submit' using errcode='42501'; end if;
      if exists(select 1 from public.apply_binding_state where binding_id=p_binding and status<>'ready') then raise exception 'agent paused' using errcode='42501'; end if;
      if public.apply_pipeline_auto_site(v_task.job) in ('naukri','instahyre') then
        v_scope:=public.apply_pipeline_auto_site(v_task.job); v_scope_key:=public.apply_pipeline_job_context(v_task.job)->>'portal';
        if not exists(select 1 from public.apply_binding_sessions where binding_id=p_binding and user_id=p_user
          and portal in (v_key,v_scope_key) and status='authenticated' and checked_at>v_now-interval '30 minutes' and checked_at<=v_now
          and account_label is not null and account_label=v_profile.facts->('portalAccountIdentity:'||v_scope)->>'value') then raise exception 'verified portal account required' using errcode='42501'; end if;
        if not public.apply_pipeline_portal_fact(v_profile.facts->('portalProfileApproved:'||v_scope),v_scope_key,v_now)
          or v_profile.facts->('portalProfileApproved:'||v_scope)->'value' is distinct from 'true'::jsonb
          or not public.apply_pipeline_portal_fact(v_profile.facts->('portalAccountIdentity:'||v_scope),v_scope_key,v_now)
          or jsonb_typeof(v_profile.facts->('portalAccountIdentity:'||v_scope)->'value') is distinct from 'string'
          or btrim(coalesce(v_profile.facts->('portalAccountIdentity:'||v_scope)->>'value',''))=''
          or not public.apply_pipeline_portal_fact(v_profile.facts->('portalResumeText:'||v_scope),v_scope_key,v_now)
          or v_profile.facts->('portalResumeText:'||v_scope)->>'value' is distinct from v_profile.resume_text then raise exception 'explicit current portal profile approval required' using errcode='42501'; end if;
      end if;
      if exists(select 1 from public.apply_question_tasks qt join public.apply_question_inbox q on q.id=qt.question_id where qt.task_id=v_task.id and q.status='pending') then raise exception 'unanswered question' using errcode='42501'; end if;
      if jsonb_typeof(p_args->'answerIds') is distinct from 'array' or jsonb_array_length(p_args->'answerIds')>100 or jsonb_typeof(p_args->'idempotencyKey') is distinct from 'string' or char_length(p_args->>'idempotencyKey') not between 1 and 200 then raise exception 'invalid reservation' using errcode='22023'; end if;
      for v_answer_id in select jsonb_array_elements_text(p_args->'answerIds') loop
        select * into v_answer from public.apply_verified_answers where id=v_answer_id::uuid and user_id=p_user and revoked_at is null and profile_revision=v_profile.revision and (expires_at is null or expires_at>v_now);
        if not found then raise exception 'unconfirmed or stale answer' using errcode='42501'; end if;
        v_context:=public.apply_pipeline_job_context(v_task.job);
        if (v_answer.scope<>'global' and v_answer.scope_key is distinct from v_context->>v_answer.scope
          or exists(select 1 from jsonb_each_text(v_answer.context) c where c.value is distinct from v_context->>c.key))
          and not exists(select 1 from public.apply_question_tasks qt join public.apply_question_inbox q on q.id=qt.question_id
            where qt.user_id=p_user and qt.task_id=v_task.id and qt.job_context=v_context and q.user_id=p_user
              and q.status='answered' and q.answer_id=v_answer.id and q.question_key=v_answer.question_key
              and q.profile_revision=v_profile.revision and q.context=v_answer.context and q.scope=v_answer.scope and q.scope_key=v_answer.scope_key
              and (v_answer.scope='global' or v_answer.scope_key=coalesce(q.context->>v_answer.scope,v_context->>v_answer.scope))
              and not exists(select 1 from jsonb_each_text(q.context) c where c.value is distinct from
                case when c.key in ('country','currency') then coalesce(public.apply_pipeline_question_label(q.question_text)->>c.key,v_context->>c.key) else v_context->>c.key end))
          then raise exception 'answer scope or context mismatch' using errcode='42501'; end if;
      end loop;
      /* Count all reservations, including failed/uncertain attempts, so neither
         retrying nor another binding can evade an owner's per-employer caps. */
      v_local:=v_now at time zone (v_settings.data->>'timeZone');
      if v_settings.data ? 'quietFrom' and (
        v_settings.data->>'quietFrom'=v_settings.data->>'quietTo'
        or v_settings.data->>'quietFrom'<v_settings.data->>'quietTo' and to_char(v_local,'HH24:MI')>=v_settings.data->>'quietFrom' and to_char(v_local,'HH24:MI')<v_settings.data->>'quietTo'
        or v_settings.data->>'quietFrom'>v_settings.data->>'quietTo' and (to_char(v_local,'HH24:MI')>=v_settings.data->>'quietFrom' or to_char(v_local,'HH24:MI')<v_settings.data->>'quietTo')) then raise exception 'quiet hours' using errcode='42501'; end if;
      v_day:=date_trunc('day',v_local) at time zone (v_settings.data->>'timeZone'); v_week:=date_trunc('week',v_local) at time zone (v_settings.data->>'timeZone');
      if (select count(*) from public.apply_submission_reservations where user_id=p_user and reserved_at>=v_day)>=(v_settings.data->>'dailyCap')::integer
        or (select count(*) from public.apply_submission_reservations where user_id=p_user and reserved_at>=v_week)>=(v_settings.data->>'weeklyCap')::integer
        or (select count(*) from public.apply_submission_reservations where user_id=p_user and reserved_at>=v_day and employer_key=lower(btrim(v_task.job->>'company')))>=(v_settings.data->>'employerDailyCap')::integer then raise exception 'submission cap reached' using errcode='42501'; end if;
      if exists(select 1 from public.apply_submission_reservations where user_id=p_user and (task_id=v_task.id or job_key=v_task.job_key or idempotency_key=p_args->>'idempotencyKey')) then raise exception 'submission already reserved' using errcode='40001'; end if;
      insert into public.apply_submission_reservations(user_id,task_id,binding_id,job_key,employer_key,idempotency_key,lease_version,lease_nonce,profile_revision,settings_revision,answers_revision,answer_ids)
        values(p_user,v_task.id,p_binding,v_task.job_key,lower(btrim(v_task.job->>'company')),p_args->>'idempotencyKey',v_task.lease_version,v_task.lease_nonce,v_profile.revision,v_settings.revision,v_profile.answers_revision,p_args->'answerIds') returning * into v_res;
      update public.apply_tasks set status='submitting',updated_at=v_now where id=v_task.id;
      return jsonb_build_object('reservation',to_jsonb(v_res)-'user_id');
    when 'submission.finish' then
      select * into v_res from public.apply_submission_reservations where id=(p_args->>'reservationId')::uuid and task_id=v_task.id and user_id=p_user and binding_id=p_binding and nonce=(p_args->>'reservationNonce')::uuid for update;
      if not found or v_res.lease_version<>v_task.lease_version or v_res.lease_nonce<>v_task.lease_nonce then raise exception 'reservation not found' using errcode='P0002'; end if;
      if coalesce(p_args->>'outcome','') not in ('submitted','unverified','failed') then raise exception 'invalid outcome' using errcode='22023'; end if;
      if v_res.status='submitted' then return jsonb_build_object('reservation',to_jsonb(v_res)-'user_id'); end if;
      if v_res.status='failed' then raise exception 'attempt already finished' using errcode='40001'; end if;
      if p_args->>'outcome'='submitted' then
        v_item:=p_args->'evidence';
        if not public.apply_pipeline_keys(v_item,array['kind','text','url']) or coalesce(v_item->>'kind','') not in ('confirmation_page','receipt')
          or jsonb_typeof(v_item->'text') is distinct from 'string' or char_length(v_item->>'text') not between 1 and 4000
          or not public.apply_pipeline_receipt_url(v_task.job->>'jobUrl',v_item->>'url')
          or v_item->>'text' !~* '(application.{0,30}(received|submitted|sent)|thanks? (you )?for applying|thank you for (your )?application|successfully applied)'
          or v_item->>'text' ~* '(not (received|submitted|sent)|fail(ed|ure)|unable|error|already|previously)' then raise exception 'positive submission evidence required' using errcode='22023'; end if;
      elsif p_args ? 'evidence' then
        v_item:=p_args->'evidence';
        if not public.apply_pipeline_keys(v_item,array['kind','text','url']) or jsonb_typeof(v_item->'text') is distinct from 'string' or char_length(v_item->>'text')>4000 then raise exception 'invalid evidence' using errcode='22023'; end if;
      end if;
      update public.apply_submission_reservations set status=p_args->>'outcome',evidence=p_args->'evidence',finished_at=v_now where id=v_res.id returning * into v_res;
      update public.apply_tasks set status=p_args->>'outcome',evidence=p_args->'evidence',reason=case when p_args->>'outcome'='unverified' then 'submission_not_verified' else null end,lease_until=null,updated_at=v_now where id=v_task.id;
      perform public.apply_pipeline_refresh_run(v_task.run_id);
      return jsonb_build_object('reservation',to_jsonb(v_res)-'user_id');
    else raise exception 'unsupported action' using errcode='22023'; end case;
  end case;
end $$;

create or replace function public.my_apply_pipeline_action(p_action text,p_args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'role','')<>'authenticated' then raise exception 'authentication required' using errcode='42501'; end if;
  return public.apply_pipeline_action(auth.uid(),null,p_action,p_args);
end $$;
create or replace function public.service_apply_pipeline_dispatch(p_binding_id uuid,p_token_hash text,p_action text,p_args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_binding public.apply_agent_bindings%rowtype; v_result jsonb; begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid or revoked binding' using errcode='42501'; end if;
  select * into v_binding from public.apply_agent_bindings where id=p_binding_id and token_hash=p_token_hash and revoked_at is null for update;
  if not found then raise exception 'invalid or revoked binding' using errcode='42501'; end if;
  v_result:=public.apply_pipeline_action(v_binding.user_id,v_binding.id,p_action,p_args);
  update public.apply_agent_bindings set last_used_at=clock_timestamp() where id=v_binding.id;
  return v_result;
end $$;

/* Internal helper EXECUTE is not inherited via PUBLIC, including service role. */
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'apply_pipeline_%' or p.proname in ('my_apply_pipeline_action','service_apply_pipeline_dispatch')) loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
  end loop;
end $$;
grant execute on function public.my_apply_pipeline_action(text,jsonb) to authenticated;
grant execute on function public.service_apply_pipeline_dispatch(uuid,text,text,jsonb) to service_role;

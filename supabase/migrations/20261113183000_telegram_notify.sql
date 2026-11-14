/* Apply after complimentary grants and tenant expand/contract, inside the
   runner's transaction. No legacy owner claim is changed here. Old bindings
   remain untested. Deploy send-notify-test only after this migration; browser
   credentials never get tokens or authority to assert successful delivery. */

alter table public.user_notify_config add column if not exists time_zone text not null default 'UTC';
alter table public.user_notify_config add column if not exists delivery_tested_at timestamptz;
alter table public.user_notify_config add column if not exists revision bigint not null default 0;
alter table public.user_notify_config drop constraint if exists user_notify_revision_check;
alter table public.user_notify_config add constraint user_notify_revision_check
  check (revision between 0 and 9007199254740991);

alter table public.user_notify_config enable row level security;
-- Remove column grants too: a table-level revoke does not remove column ACLs.
revoke all on public.user_notify_config from public, anon, authenticated;
do $$ declare c record; p record; begin
  for c in select attname from pg_attribute
    where attrelid = 'public.user_notify_config'::regclass and attnum > 0 and not attisdropped loop
    execute format('revoke all (%I) on public.user_notify_config from public, anon, authenticated', c.attname);
  end loop;
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'user_notify_config' loop
    execute format('drop policy %I on public.user_notify_config', p.policyname);
  end loop;
end $$;
grant select, insert, update on public.user_notify_config to service_role;

create table if not exists public.notify_delivery_rate (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 5)
);
alter table public.notify_delivery_rate enable row level security;
revoke all on public.notify_delivery_rate from public, anon, authenticated;

-- Internal projection shared by both RPCs; it is deliberately not callable by browsers.
create or replace function public.notify_binding_metadata(p_user uuid)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object('chat_id', n.chat_id, 'has_token', coalesce(n.bot_token, '') <> '',
    'time_zone', n.time_zone, 'delivery_tested_at', n.delivery_tested_at,
    'updated_at', n.updated_at, 'revision', n.revision)
  from public.user_notify_config n where n.user_id = p_user;
$$;
revoke all on function public.notify_binding_metadata(uuid) from public, anon, authenticated, service_role;

create or replace function public.get_my_notify_config()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  return public.notify_binding_metadata(auth.uid());
end $$;
revoke all on function public.get_my_notify_config() from public, anon, authenticated, service_role;
grant execute on function public.get_my_notify_config() to authenticated;

/* p_user is supplied only by the authenticated Edge handler. No request can
   specify an owner, delivery timestamp, revision increment, or arbitrary field.
   An auth.users row lock serializes even missing bindings without deleting the
   tombstone. The network await never holds a database transaction open. */
create or replace function public.notify_binding_action(p_user uuid, p_operation text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_current public.user_notify_config%rowtype;
  v_exists boolean;
  v_revision bigint;
  v_zone text;
  v_token text;
  v_chat text;
  v_now timestamptz := clock_timestamp();
  v_rate public.notify_delivery_rate%rowtype;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then raise exception 'service role required'; end if;
  if p_operation is null or p_operation not in ('read', 'claim', 'save', 'test', 'unbind') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_settings');
  end if;
  if p_args is null or jsonb_typeof(p_args) <> 'object' or exists (
    select 1 from jsonb_object_keys(p_args) k where k <> all(case
      when p_operation = 'read' then array[]::text[]
      when p_operation = 'save' then array['revision','chatId','botToken','timeZone']
      else array['revision'] end)
  ) then return jsonb_build_object('ok', false, 'reason', 'invalid_settings'); end if;
  if p_user is null then raise exception 'invalid owner'; end if;
  perform 1 from auth.users where id = p_user for update;
  if not found then raise exception 'invalid owner'; end if;
  if p_operation <> 'unbind' and not public.has_auto_apply_access(p_user) then
    return jsonb_build_object('ok', false, 'reason', 'not_entitled');
  end if;
  select * into v_current from public.user_notify_config where user_id = p_user for update;
  v_exists := found;
  if p_operation = 'read' then
    return jsonb_build_object('ok', true, 'config', public.notify_binding_metadata(p_user), 'bot_token', v_current.bot_token);
  end if;
  if not p_args ? 'revision' or (jsonb_typeof(p_args->'revision') not in ('number','null')) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_settings');
  end if;
  if jsonb_typeof(p_args->'revision') = 'number' then
    if p_args->>'revision' !~ '^[0-9]{1,16}$' or (p_args->>'revision')::numeric > 9007199254740991 then
      return jsonb_build_object('ok', false, 'reason', 'invalid_settings');
    end if;
    v_revision := (p_args->>'revision')::bigint;
  end if;
  if (v_exists and v_revision is distinct from v_current.revision) or (not v_exists and v_revision is not null) then
    return jsonb_build_object('ok', false, 'reason', 'stale_binding');
  end if;
  if p_operation = 'claim' then
    select * into v_rate from public.notify_delivery_rate where user_id = p_user for update;
    if found and v_rate.window_started_at > v_now - interval '1 minute' then
      if v_rate.attempts >= 5 then return jsonb_build_object('ok', false, 'reason', 'rate_limited'); end if;
      update public.notify_delivery_rate set attempts = attempts + 1 where user_id = p_user;
    else
      insert into public.notify_delivery_rate(user_id, window_started_at, attempts) values (p_user, v_now, 1)
        on conflict(user_id) do update set window_started_at = excluded.window_started_at, attempts = 1;
    end if;
    return jsonb_build_object('ok', true);
  end if;
  if coalesce(v_current.revision, 0) >= 9007199254740991 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_settings');
  end if;
  if p_operation = 'save' then
    if jsonb_typeof(p_args->'chatId') is distinct from 'string'
      or jsonb_typeof(p_args->'botToken') is distinct from 'string'
      or jsonb_typeof(p_args->'timeZone') is distinct from 'string' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_settings');
    end if;
    v_chat := btrim(p_args->>'chatId');
    v_token := coalesce(nullif(btrim(p_args->>'botToken'), ''), v_current.bot_token);
    v_zone := btrim(p_args->>'timeZone');
    if length(p_args->>'chatId') > 32 or v_chat !~ '^-?[1-9][0-9]{0,19}$'
      or length(p_args->>'botToken') > 160 or v_token is null or v_token !~ '^[0-9]{5,16}:[A-Za-z0-9_-]{20,128}$'
      or length(v_zone) > 100 or not exists(select 1 from pg_timezone_names where name = v_zone) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_settings');
    end if;
    insert into public.user_notify_config(user_id, chat_id, bot_token, time_zone, delivery_tested_at, updated_at, revision)
    values(p_user, v_chat, v_token, v_zone, v_now, v_now, coalesce(v_current.revision, 0) + 1)
    on conflict(user_id) do update set chat_id = excluded.chat_id, bot_token = excluded.bot_token,
      time_zone = excluded.time_zone, delivery_tested_at = excluded.delivery_tested_at,
      updated_at = excluded.updated_at, revision = excluded.revision;
  elsif p_operation = 'test' then
    if not v_exists or coalesce(v_current.chat_id, '') = '' or coalesce(v_current.bot_token, '') = '' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_settings');
    end if;
    update public.user_notify_config set delivery_tested_at = v_now, updated_at = v_now,
      revision = revision + 1 where user_id = p_user;
  else
    -- Keep the tombstone revision: deleting it lets a stale first save resurrect a binding.
    insert into public.user_notify_config(user_id, chat_id, bot_token, time_zone, delivery_tested_at, updated_at, revision)
    values(p_user, null, null, 'UTC', null, v_now, coalesce(v_current.revision, 0) + 1)
    on conflict(user_id) do update set chat_id = null, bot_token = null, time_zone = 'UTC',
      delivery_tested_at = null, updated_at = excluded.updated_at, revision = excluded.revision;
  end if;
  return jsonb_build_object('ok', true, 'config', public.notify_binding_metadata(p_user));
end $$;
revoke all on function public.notify_binding_action(uuid, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.notify_binding_action(uuid, text, jsonb) to service_role;

-- Preserve existing authorized admin cleanup without its old DELETE/CAS hole.
create or replace function public.admin_clear_user_notify(p_user uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not (coalesce(public.is_admin(), false) or coalesce(auth.jwt()->>'role', '') = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_user is null then raise exception 'invalid owner'; end if;
  perform 1 from auth.users where id = p_user for update;
  if not found then raise exception 'invalid owner'; end if;
  insert into public.user_notify_config(user_id, chat_id, bot_token, time_zone, delivery_tested_at, updated_at, revision)
  values(p_user, null, null, 'UTC', null, clock_timestamp(), 1)
  on conflict(user_id) do update set chat_id = null, bot_token = null, time_zone = 'UTC',
    delivery_tested_at = null, updated_at = excluded.updated_at, revision = user_notify_config.revision + 1;
end $$;
revoke all on function public.admin_clear_user_notify(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_clear_user_notify(uuid) to authenticated, service_role;

-- Optional legacy token readers must not bypass the new metadata-only reader.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'admin_get_notify_config','engine_notify_config','admin_user_notify_row','admin_list_user_notify'
    ]) loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;

/* Add occurrence time without rewriting historical insertion timestamps.
   Existing records fall back to created_at; event retries remain DO NOTHING. */
alter table public.apply_results add column if not exists occurred_at timestamptz;
update public.apply_results set occurred_at = created_at where occurred_at is null;
alter table public.apply_results alter column occurred_at set default now();

/* Preserve the exact installed canonical implementation for every other action.
   Rename once, never restore expand's ACLs, and abort on a missing prerequisite.
   The base is not a public RPC, including for the service role. */
do $$ begin
  if to_regprocedure('public.apply_core_action_telegram_base(uuid,text,jsonb)') is null then
    if to_regprocedure('public.apply_core_action(uuid,text,jsonb)') is null then
      raise exception 'tenant dispatcher prerequisite missing';
    end if;
    alter function public.apply_core_action(uuid, text, jsonb) rename to apply_core_action_telegram_base;
  end if;
end $$;
revoke all on function public.apply_core_action_telegram_base(uuid, text, jsonb) from public, anon, authenticated, service_role;

create or replace function public.apply_core_action(p_user uuid, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_result jsonb; v_occurred timestamptz; v_limit integer;
begin
  if p_user is null or not exists(select 1 from auth.users where id = p_user) then raise exception 'invalid owner'; end if;
  if p_args is null or jsonb_typeof(p_args) <> 'object' then raise exception 'args must be an object'; end if;
  if p_args ?| array['user_id','userId','p_user','p_user_id'] then raise exception 'owner is derived from authentication'; end if;
  if p_action = 'notify.get' then
    select to_jsonb(x) into v_result from (
      select chat_id, bot_token, time_zone from public.user_notify_config where user_id = p_user
    ) x;
    return coalesce(v_result, 'null'::jsonb);
  elsif p_action = 'results.list' then
    v_limit := least(greatest(coalesce((p_args->>'limit')::int, 100), 1), 500);
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_result from (
      select id, site_host, job_url, title, company, result, detail, fit, posted_age_h, feedback, created_at, occurred_at
      from public.apply_results where user_id = p_user and (p_args->>'host' is null or site_host = p_args->>'host')
      order by created_at desc, id desc limit v_limit
    ) x;
    return v_result;
  elsif p_action = 'results.record' then
    if not public.has_auto_apply_access(p_user) then raise exception 'auto-apply entitlement required'; end if;
    if p_args->>'result' is null or p_args->>'result' not in ('submitted','needs_review','skipped','error','budget_capped','filtered') then
      raise exception 'bad result';
    end if;
    if coalesce(p_args->>'jobUrl', '') = '' or coalesce(p_args->>'siteHost', '') = '' then raise exception 'site and job URL required'; end if;
    if p_args ? 'occurredAt' then
      if jsonb_typeof(p_args->'occurredAt') is distinct from 'string'
        or length(p_args->>'occurredAt') > 64
        or p_args->>'occurredAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
        raise exception 'invalid event timestamp';
      end if;
      v_occurred := (p_args->>'occurredAt')::timestamptz;
      if not isfinite(v_occurred) then raise exception 'invalid event timestamp'; end if;
    else v_occurred := now(); end if;
    insert into public.apply_results(user_id, site_host, job_url, title, company, result, detail, fit, posted_age_h, agent_event_id, occurred_at)
    values (p_user, left(p_args->>'siteHost', 255), left(p_args->>'jobUrl', 4096), left(p_args->>'title', 500),
      left(p_args->>'company', 500), p_args->>'result', left(p_args->>'detail', 4000),
      (p_args->>'fit')::int, (p_args->>'ageH')::int, (p_args->>'eventId')::uuid, v_occurred)
    on conflict(user_id, agent_event_id) where agent_event_id is not null do nothing;
    return 'null'::jsonb;
  end if;
  return public.apply_core_action_telegram_base(p_user, p_action, p_args);
end $$;
revoke all on function public.apply_core_action(uuid, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.apply_core_action(uuid, text, jsonb) to service_role;

-- Invalidate existing compiled calls to the renamed OID while retaining the
-- exact installed guards/signatures/ACLs of both canonical entry wrappers.
do $$ declare f record; begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('my_apply_action', 'apply_agent_action') loop
    execute pg_get_functiondef(f.oid);
  end loop;
end $$;

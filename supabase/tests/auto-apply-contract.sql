-- Local fixture only: exercise the staged contract inside a rollback transaction.
begin;
insert into public.apply_agent_bindings(id,user_id,token_hash,label,last_used_at)
values('cccccccc-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',repeat('c',64),'Contract test',now());
select set_config('app.apply_scoped_smoke_verified','true',true);
\ir ../migrations/20261113_apply_tenant_contract.sql
-- Replay must stay safe and never restore a legacy default.
\ir ../migrations/20261113_apply_tenant_contract.sql
do $$ begin
  if (select legacy_enabled from public.apply_tenant_rollout where id) then raise exception 'legacy mode stayed enabled'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='apply_results'
    and column_name='user_id' and column_default is not null) then raise exception 'legacy default survived contract'; end if;
  if has_function_privilege('anon','public.my_apply_action(text,jsonb)','EXECUTE') then raise exception 'anonymous self dispatcher access'; end if;
  if not has_function_privilege('authenticated','public.my_apply_action(text,jsonb)','EXECUTE') then raise exception 'self dispatcher disabled'; end if;
  if has_function_privilege('authenticated','public.service_apply_agent_dispatch(uuid,text,text,jsonb)','EXECUTE') then raise exception 'browser reached service dispatcher'; end if;
end $$;
rollback;

-- Only for a disposable database that already loaded auto-apply-bootstrap.sql,
-- complimentary-grants and apply-agent-bindings. Never a production fixture.
create table if not exists public.jobs (
  id bigint generated always as identity primary key, source text not null,
  external_id text not null, title text not null, company text not null,
  location text, remote boolean not null default false, description text not null default '',
  url text not null, skills jsonb not null default '[]', posted_at timestamptz,
  meta jsonb not null default '{}', salary jsonb, unique(source,external_id)
);
insert into public.jobs(source,external_id,title,company,location,description,url,skills,posted_at,meta,salary) values
 ('greenhouse','proof-one','Software Engineer','Proof Employer','Remote','Build TypeScript services.','https://boards.greenhouse.io/proof/jobs/1','["typescript","sql"]',now()-interval '1 hour','{"country":"US"}','{"min":100000,"max":150000,"currency":"USD","period":"year"}'),
 ('greenhouse','proof-two','Software Engineer','Proof Employer','Remote','Build TypeScript services.','https://boards.greenhouse.io/proof/jobs/2','["typescript"]',now()-interval '2 hours','{"country":"US"}',null),
 ('ashby','proof-three','Software Engineer','Other Employer','Remote','Build TypeScript services.','https://jobs.ashbyhq.com/proof/123e4567-e89b-42d3-a456-426614174000','["typescript"]',now()-interval '3 hours','{"country":"US"}',null),
 ('lever','proof-four','Software Engineer','Review Employer','Remote','Build TypeScript services.','https://jobs.lever.co/proof/123e4567-e89b-42d3-a456-426614174000','["typescript"]',now()-interval '4 hours','{"country":"US"}',null),
 ('greenhouse','proof-filter','Chef','Excluded Employer','London','Not an engineering role.','https://boards.greenhouse.io/proof/jobs/5','["cooking"]',now()-interval '5 hours','{"country":"GB"}',null)
on conflict(source,external_id) do nothing;
insert into public.apply_agent_bindings(id,user_id,token_hash,label) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222',repeat('a',64),'Synthetic A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333',repeat('b',64),'Synthetic B'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222',repeat('c',64),'Synthetic A second')
on conflict(id) do nothing;

create or replace function public.test_apply_pipeline_assert(p_ok boolean,p_message text)
returns void language plpgsql as $$ begin if p_ok is distinct from true then raise exception 'ASSERT: %',p_message; end if; end $$;
create or replace function public.test_apply_pipeline_denied(p_sql text,p_states text[] default array['42501','22023','40001','P0002','22P02'])
returns void language plpgsql as $$
declare v_state text; begin
  begin execute p_sql; exception when others then get stacked diagnostics v_state=returned_sqlstate; end;
  if v_state is null or not v_state=any(p_states) then raise exception 'Expected rejection, got SQLSTATE % for %',v_state,p_sql; end if;
end $$;

-- Match and scope helpers are tested as database owner, not exposed RPCs.
begin;
do $$ declare f jsonb; s jsonb; j jsonb; m jsonb; begin
  f:='{"skills":{"value":["typescript","sql"],"source":"user","confirmedAt":"2026-11-14T00:00:00Z"},"role":{"value":"Software Engineer","source":"user","confirmedAt":"2026-11-14T00:00:00Z"},"locations":{"value":["Remote"],"source":"user","confirmedAt":"2026-11-14T00:00:00Z"}}';
  s:='{"enabled":true,"autoSubmit":true,"threshold":60,"dailyCap":10,"weeklyCap":50,"employerDailyCap":2,"timeZone":"UTC","roles":[],"locations":[],"countries":[],"excludeCompanies":[],"requireWorkAuthorization":false,"allowSponsorship":true,"maxAgeDays":14,"aiConsent":false}';
  j:='{"jobUrl":"https://boards.greenhouse.io/proof/jobs/1","title":"Software Engineer","company":"Proof Employer","description":"Build software","skills":["typescript","sql"],"location":"Remote","country":"US","postedAt":"2026-11-14T10:00:00Z"}';
  m:=public.apply_pipeline_match(f,s,j,'2026-11-14T12:00:00Z');
  perform public.test_apply_pipeline_assert(m='{"score":100,"reason":null}'::jsonb,'SQL pure overlap matches confirmed explicit preference fallback');
  m:=public.apply_pipeline_match(f,s,j||'{"skills":["typescript","java","rust"]}','2026-11-14T12:00:00Z');
  perform public.test_apply_pipeline_assert(m='{"score":33,"reason":"below_threshold"}'::jsonb,'explainable overlap score rounds down');
  perform public.test_apply_pipeline_assert(public.apply_pipeline_match(f,s,j-'postedAt','2026-11-14T12:00:00Z')->>'reason'='posting_age_unknown_or_stale','no unknown freshness guessing');
  perform public.test_apply_pipeline_assert(public.apply_pipeline_match(f,s||'{"requireWorkAuthorization":true}',j,'2026-11-14T12:00:00Z')->>'reason'='work_authorization_unconfirmed','legal claims require explicit scoped true');
  f:=f||'{"workAuthorization":{"value":true,"source":"user","confirmedAt":"2026-11-14T00:00:00Z","scope":{"country":"GB"}}}';
  perform public.test_apply_pipeline_assert(public.apply_pipeline_match(f,s||'{"requireWorkAuthorization":true}',j,'2026-11-14T12:00:00Z')->>'reason'='work_authorization_unconfirmed','wrong country fact rejected');
  f:=f||'{"workAuthorization":{"value":true,"source":"user","confirmedAt":"2026-11-14T00:00:00Z","scope":{"country":"US"}}}';
  perform public.test_apply_pipeline_assert(public.apply_pipeline_match(f,s||'{"requireWorkAuthorization":true}',j,'2026-11-14T12:00:00Z')->>'reason' is null,'exact country verified true permits matching');
  perform public.test_apply_pipeline_assert(public.apply_pipeline_match(f,s||'{"minimumSalary":{"value":100000,"currency":"USD","period":"year"}}',j,'2026-11-14T12:00:00Z')->>'reason'='salary_unknown_or_below_minimum','no currency/salary invention');
  perform public.test_apply_pipeline_assert(public.apply_pipeline_match(f,s||'{"minimumSalary":{"value":100000,"currency":"USD","period":"year"}}',j||'{"salary":{"min":90000,"max":120000,"currency":"USD","period":"year"}}','2026-11-14T12:00:00Z')->>'reason' is null,'advertised explicit salary band uses matching currency and period');
  perform public.test_apply_pipeline_assert(public.apply_pipeline_job_key('https://boards.greenhouse.io/proof/jobs/1?utm_source=x')=public.apply_pipeline_job_key('https://boards.greenhouse.io/proof/jobs/1'),'tracking params cannot duplicate same posting');
  perform public.test_apply_pipeline_assert(public.apply_pipeline_job_key('https://example.com/apply?job=1')<>public.apply_pipeline_job_key('https://example.com/apply?job=2'),'identity query params preserve different postings');
  perform public.test_apply_pipeline_assert(public.apply_pipeline_job_context(j)->>'portal'='greenhouse:boards.greenhouse.io/proof','scope portal is board-specific adapter identity');
  perform public.test_apply_pipeline_assert(public.apply_pipeline_job_context(j)->>'employer'='proof employer','normalized employer matches pure resolver');
  perform public.test_apply_pipeline_assert(public.apply_pipeline_auto_site(j)='greenhouse' and public.apply_pipeline_auto_site(j||'{"jobUrl":"https://boards.greenhouse.io/proof"}') is null,'auto-submit requires path-qualified posting, not host alone');
  perform public.test_apply_pipeline_assert(not public.apply_pipeline_keys(null,array['a']) and not public.apply_pipeline_keys('null',array['a']),'null objects never pass validation');
  perform public.test_apply_pipeline_assert(not public.apply_pipeline_public_url('https://user:password@example.com/jobs') and not public.apply_pipeline_public_url('https://10.0.0.1/jobs'),'unsafe targets rejected in SQL');
end $$;

-- Dedicated per-portal facts stay user-confirmed, typed and explicitly scoped.
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
set local role authenticated;
do $$ declare p jsonb; begin
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('profile.confirm','{"expectedRevision":null,"facts":{"portalProfileApproved:naukri":{"value":true,"source":"user"}},"resumeText":"","resumeApproved":false}')$q$);
  perform public.test_apply_pipeline_denied($q$select public.my_apply_pipeline_action('profile.confirm','{"expectedRevision":null,"facts":{"skillYears:react":{"value":"many","source":"user"}},"resumeText":"","resumeApproved":false}')$q$);
  p:=public.my_apply_pipeline_action('profile.confirm','{"expectedRevision":null,"facts":{"portalProfileApproved:naukri":{"value":true,"source":"user","scope":{"portal":"naukri:naukri.com/account"}},"portalAccountIdentity:naukri":{"value":"user@example.com","source":"user","scope":{"portal":"naukri:naukri.com/account"}},"portalResumeText:naukri":{"value":"Exact stored portal resume","source":"user","scope":{"portal":"naukri:naukri.com/account"}},"portalProfileApproved:instahyre":{"value":true,"source":"user","scope":{"portal":"instahyre:instahyre.com/account"}}},"resumeText":"","resumeApproved":false}');
  perform public.test_apply_pipeline_assert(p->'profile'->'facts'->'portalProfileApproved:naukri'->'value'='true'::jsonb and p->'profile'->'facts'->'portalProfileApproved:instahyre'->'value'='true'::jsonb,'multiple portal approvals coexist without widening scope');
end $$;
reset role;
rollback;

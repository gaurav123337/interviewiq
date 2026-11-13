# Post-rollout read-only verification. No grants, messages, or agent activation.
$ErrorActionPreference = 'Stop'
$project = 'ndrusywvceojsoirhkhl'
$owner = '5f6bce44-1cc7-45d0-9429-f37e09cdf745'
$file = Join-Path $env:LOCALAPPDATA 'InterviewIQ\management\supabase-token.dpapi'
$secure = $null; $ptr=[IntPtr]::Zero; $headers=$null
function Query([string]$Sql) {
  try {
    $result = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$project/database/query" -Headers $headers -ContentType 'application/json' -Body (@{query=$Sql}|ConvertTo-Json -Compress) -TimeoutSec 90
    foreach ($row in $result) { Write-Output $row }
  } catch { throw 'Post-rollout read-only verification query failed; private data and credentials are not printed.' }
}
try {
  $secure=ConvertTo-SecureString -String ([IO.File]::ReadAllText($file))
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $headers=@{Authorization='Bearer '+[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
  $tables=@('apply_results','job_apply_reviews','apply_resume_variants','form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes')
  $sql=foreach($table in $tables) { "select '$table' as table_name,count(*) as total,count(*) filter(where user_id='$owner'::uuid) as legacy_owner_rows,count(*) filter(where user_id is null) as unowned from public.$table" }
  $counts=@(Query ($sql -join ' union all '))
  $acl=@(Query "select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,has_function_privilege('anon',p.oid,'execute') as anon_execute,has_function_privilege('authenticated',p.oid,'execute') as user_execute,has_function_privilege('service_role',p.oid,'execute') as service_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_list_apply_results','admin_list_job_reviews','admin_list_resume_variants','engine_list_apply_results_for_host','engine_get_apply_policy','log_billing_action','my_apply_action','apply_agent_action','service_apply_agent_dispatch','has_auto_apply_access','get_my_entitlement','redeem_grant') order by p.proname")
  $state=@(Query "select 'rollout' as kind,jsonb_build_object('legacy_user_id',legacy_user_id,'legacy_enabled',legacy_enabled) as value from public.apply_tenant_rollout where id union all select 'apply_mode',jsonb_build_object('mode',mode) from public.apply_config where id='global' union all select 'complimentary_grants',to_jsonb(count(*)) from public.complimentary_grants union all select 'bindings',to_jsonb(count(*)) from public.apply_agent_bindings union all select 'billing_actions',to_jsonb(count(*)) from public.billing_actions")
  $policies=@(Query "select tablename,policyname,cmd,qual from pg_policies where schemaname='public' and tablename in ('apply_results','job_apply_reviews','apply_resume_variants','form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes','user_notify_config') order by tablename,policyname")
  $functions=Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$project/functions" -Headers $headers -TimeoutSec 60
  $approvedFunctions=@($functions | ForEach-Object {$_} | Where-Object {$_.slug -in @('apply-agent','send-notify-test')} | Select-Object slug,status,version,verify_jwt)
  $keys=Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$project/api-keys" -Headers $headers -TimeoutSec 60
  $publicKey=($keys | Where-Object {$_.name -eq 'anon'} | Select-Object -First 1).api_key
  if (-not $publicKey) { throw 'Public gateway key unavailable for anonymous rejection probes' }
  $probes=@()
  foreach($fn in @('apply-agent','send-notify-test')) {
    try {
      $r=Invoke-WebRequest -UseBasicParsing -Method Post -Uri "https://$project.supabase.co/functions/v1/$fn" -Headers @{apikey=$publicKey;'Content-Type'='application/json'} -Body $(if($fn -eq 'apply-agent'){'{"operation":"bindings.list"}'}else{'{}'}) -TimeoutSec 60
      $probes+=@{function=$fn;anonymous_status=[int]$r.StatusCode}
    } catch {
      $status=if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{0}
      $probes+=@{function=$fn;anonymous_status=$status}
    }
  }
  $old=@{apply_results=1911;job_apply_reviews=114;apply_resume_variants=0;form_answers=25;apply_skill_strikes=3;judge_exemplars=82;apply_outcomes=0}
  foreach($c in $counts) {
    if($c.total -ne $old[$c.table_name] -or $c.unowned -ne 0 -or $c.legacy_owner_rows -ne $c.total){throw "Row preservation/ownership verification failed for $($c.table_name)"}
  }
  $unsafe=@($acl | Where-Object {$_.proname -in @('admin_list_apply_results','admin_list_job_reviews','admin_list_resume_variants','engine_list_apply_results_for_host','engine_get_apply_policy','log_billing_action') -and ($_.anon_execute -or $_.user_execute)})
  if($unsafe.Count){throw 'Unsafe legacy RPC execution privilege remains'}
  if(@($approvedFunctions | Where-Object {$_.status -eq 'ACTIVE' -and -not $_.verify_jwt}).Count -ne 2){throw 'Approved Edge function deployment state not verified'}
  if(@($probes | Where-Object {$_.anonymous_status -notin @(401,403)}).Count){throw 'Anonymous Edge rejection probe did not fail closed'}
  @{verified=$true;project=$project;counts=$counts;rpc_acl=$acl;state=$state;policies=$policies;edge_functions=$approvedFunctions;anonymous_probes=$probes;live_reads_only=$true} | ConvertTo-Json -Depth 12
} catch { Write-Output ('Verification stopped: '+$_.Exception.Message);exit 1 }
finally {
  $headers=$null;$keys=$null;$publicKey=$null
  if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
  if($secure){$secure.Dispose()}
}

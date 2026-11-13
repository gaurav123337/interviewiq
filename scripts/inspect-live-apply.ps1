# Read-only live rollout preflight. Never prints or persists plaintext credentials.
$ErrorActionPreference = "Stop"
$project = "ndrusywvceojsoirhkhl"
$ownerEmail = "gaurav.123337@gmail.com" # Legacy owner declared by this repository's auth configuration.
$tokenFile = Join-Path $env:LOCALAPPDATA "InterviewIQ\management\supabase-token.dpapi"
$ptr = [IntPtr]::Zero
$secure = $null
$headers = $null

function Read-Query([string]$Sql) {
  $body = @{ query = $Sql } | ConvertTo-Json -Compress
  try {
    $result = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$project/database/query" -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 90
    foreach ($row in $result) { Write-Output $row }
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "network" }
    $message = ""
    try {
      $detail = $_.ErrorDetails.Message | ConvertFrom-Json
      $message = [string]$detail.message
      if (-not $message) { $message = [string]$detail.error }
      $message = $message -replace 'sbp_[A-Za-z0-9]+', '[redacted]'
    } catch { $message = "metadata query rejected" }
    throw "Read-only Supabase query failed (HTTP $status): $message. No database changes requested."
  }
}

try {
  $secure = ConvertTo-SecureString -String ([IO.File]::ReadAllText($tokenFile))
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if ($token -notmatch '^sbp_[A-Za-z0-9]+$') { throw "Saved credential is not a management token" }
  $headers = @{ Authorization = "Bearer $token" }
  try {
    $details = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$project" -Headers $headers -TimeoutSec 60
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "network" }
    throw "Supabase project lookup failed (HTTP $status). Check token access; no live changes made."
  }
  if ($details.id -ne $project) { throw "Returned project does not match the configured target" }
  $owner = @(Read-Query "select id, email_confirmed_at is not null as email_confirmed from auth.users where lower(email) = '$ownerEmail'")
  $tables = @(Read-Query "select name, to_regclass('public.' || name) is not null as installed from unnest(array['apply_results','job_apply_reviews','apply_resume_variants','form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes','user_notify_config','entitlements','grant_codes','billing_actions','profiles','app_admins','job_sites']) as name")
  $columns = @(Read-Query "select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name in ('apply_results','job_apply_reviews','apply_resume_variants','form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes','user_notify_config','entitlements','grant_codes','profiles','app_admins') order by table_name,ordinal_position")
  $counts = @()
  foreach ($table in $tables) {
    if ($table.installed) { $counts += @(Read-Query "select '$($table.name)' as table_name,count(*) as row_count from public.$($table.name)") }
  }
  $functions = @(Read-Query "select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as returns,p.prosecdef as definer,has_function_privilege('anon',p.oid,'execute') as anon_execute,has_function_privilege('authenticated',p.oid,'execute') as user_execute,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_admin','is_job_sites_admin','log_billing_action','admin_get_apply_config','engine_get_apply_policy','engine_list_apply_results_for_host','admin_list_apply_results','admin_list_job_reviews','engine_record_apply_result','engine_queue_job_review','admin_list_resume_variants','get_my_entitlement','redeem_grant','apply_agent_action','my_apply_action','has_auto_apply_access','review_posting_key','fit_band_of','admin_list_entitlements') order by p.proname,p.oid")
  $policies = @(Read-Query "select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('apply_results','job_apply_reviews','apply_resume_variants','form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes','user_notify_config') order by tablename,policyname")
  $backups = $null
  try {
    $backupData = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$project/database/backups" -Headers $headers -TimeoutSec 60
    $backups = @{ region = $backupData.region; pitr_enabled = $backupData.pitr_enabled; backups = @($backupData.backups | Select-Object inserted_at,status) }
  } catch { $backups = @{ available = $false; note = "Backup metadata unavailable; recovery must be verified separately." } }
  $constraints = @(Read-Query "select c.conrelid::regclass::text as table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) as definition from pg_constraint c where c.conrelid in (select oid from pg_class where relnamespace='public'::regnamespace and relname in ('apply_results','job_apply_reviews','apply_resume_variants','form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes','entitlements','grant_codes','billing_actions')) order by c.conrelid,c.conname")
  $indexes = @(Read-Query "select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename in ('apply_results','job_apply_reviews','apply_resume_variants','form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes') order by tablename,indexname")
  $compatibility = @(Read-Query "select 'result_states' as check_name,coalesce(jsonb_agg(distinct result),'[]') as value from public.apply_results union all select 'review_states',coalesce(jsonb_agg(distinct status),'[]') from public.job_apply_reviews union all select 'duplicate_exemplars',to_jsonb(count(*)) from (select kind,left(lower(summary),200) from public.judge_exemplars group by kind,left(lower(summary),200) having count(*)>1) x union all select 'migration_objects',jsonb_build_object('rollout',to_regclass('public.apply_tenant_rollout') is not null,'grants',to_regclass('public.complimentary_grants') is not null,'bindings',to_regclass('public.apply_agent_bindings') is not null)")
  $engine = @(Read-Query "select id,mode,updated_at from public.apply_config")
  $dependencies = @(Read-Query "select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('apply_purchase','admin_set_addon','plan_days','admin_engine_state','admin_engine_events','admin_login_status','admin_run_status')")
  $edge = @()
  try {
    $functionsList = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$project/functions" -Headers $headers -TimeoutSec 60
    $edge = @($functionsList | ForEach-Object { $_ } | Select-Object slug,status,version,verify_jwt)
  } catch { $edge = @(@{ note = "Function metadata unavailable" }) }
  @{ project = @{ id=$details.id; name=$details.name; status=$details.status; region=$details.region }; owner_email=$ownerEmail; matching_owner_accounts=$owner; tables=$tables; row_counts=$counts; columns=$columns; functions=$functions; policies=$policies; constraints=$constraints; indexes=$indexes; compatibility=$compatibility; engine_config=$engine; dependencies=$dependencies; backups=$backups; edge_functions=$edge; read_only=$true } | ConvertTo-Json -Depth 14
} catch {
  Write-Error $_.Exception.Message
  exit 1
} finally {
  $headers = $null
  $token = $null
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if ($secure) { $secure.Dispose() }
}

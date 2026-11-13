# Read-only recovery snapshot, encrypted with this Windows account's DPAPI.
# It is not a full Supabase backup and is never used for automatic rollback.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security
$project = "ndrusywvceojsoirhkhl"
$root = Join-Path $env:LOCALAPPDATA "InterviewIQ\management"
$tokenFile = Join-Path $root "supabase-token.dpapi"
$ptr = [IntPtr]::Zero
$secure = $null
$plain = $null
$headers = $null
function Read-Query([string]$Sql) {
  try {
    $response = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$project/database/query" -Headers $headers -ContentType "application/json" -Body (@{query=$Sql} | ConvertTo-Json -Compress) -TimeoutSec 120
    foreach ($row in $response) { Write-Output $row }
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'network' }
    throw "Read-only snapshot query failed (HTTP $status, stage $script:stage). No live changes made; credential/data details are not printed."
  }
}
try {
  $secure = ConvertTo-SecureString -String ([IO.File]::ReadAllText($tokenFile))
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $headers = @{Authorization="Bearer " + [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
  $tables = @('apply_results','job_apply_reviews','apply_resume_variants','form_answers','apply_skill_strikes','judge_exemplars','apply_outcomes','user_notify_config','entitlements','grant_codes','billing_actions','apply_config')
  $queries = foreach ($table in $tables) { "select '$table' as table_name,coalesce(jsonb_agg(to_jsonb(t)),'[]') as rows from public.$table t" }
  $script:stage = 'selected-table-data'
  $data = @(Read-Query ($queries -join ' union all '))
  $script:stage = 'function-definitions'
  $definitions = @(Read-Query "select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_functiondef(p.oid) as definition,p.proacl::text as privileges from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'")
  $script:stage = 'schema-columns'
  $columns = @(Read-Query "select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public'")
  $constraints = @(Read-Query "select c.conrelid::regclass::text as table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid where t.relnamespace='public'::regnamespace")
  $indexes = @(Read-Query "select tablename,indexname,indexdef from pg_indexes where schemaname='public'")
  $policies = @(Read-Query "select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public'")
  $json = @{project=$project;created_at=[DateTime]::UtcNow.ToString('o');scope='selected auto-apply/billing tables plus public schema metadata; not full database';data=$data;functions=$definitions;columns=$columns;constraints=$constraints;indexes=$indexes;policies=$policies} | ConvertTo-Json -Depth 50 -Compress
  $plain = [Text.Encoding]::UTF8.GetBytes($json)
  $encrypted = [Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  $directory = Join-Path $root ('snapshot-' + [Guid]::NewGuid().ToString('N'))
  [void][IO.Directory]::CreateDirectory($directory)
  $file = Join-Path $directory 'pre-rollout.dpapi'
  [IO.File]::WriteAllBytes($file,$encrypted)
  $verify = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($file),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  try {
    if ($verify.Length -ne $plain.Length -or [Text.Encoding]::UTF8.GetString($verify) -cne $json) { throw 'Snapshot verification failed' }
  } finally { [Array]::Clear($verify,0,$verify.Length) }
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $hash = ([BitConverter]::ToString($sha.ComputeHash($encrypted))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
  $counts = foreach ($item in $data) { @{table=$item.table_name;rows=@($item.rows).Count} }
  @{project=$project;encrypted_snapshot=$file;encrypted_bytes=$encrypted.Length;ciphertext_sha256=$hash;verified=$true;row_counts=$counts;live_changes=$false} | ConvertTo-Json -Depth 5
} catch {
  Write-Error $_.Exception.Message
  exit 1
} finally {
  $headers=$null; $json=$null
  if ($plain) { [Array]::Clear($plain,0,$plain.Length) }
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if ($secure) { $secure.Dispose() }
}

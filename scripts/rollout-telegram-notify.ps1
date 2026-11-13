# Targeted notification rollout. Default performs only metadata inspection.
# This is not the tenant expansion runner and never starts an engine or sends a message.
param([switch]$ConfirmedNotificationRelease, [switch]$FunctionsOnly)
$ErrorActionPreference = 'Stop'
if ($FunctionsOnly -and -not $ConfirmedNotificationRelease) { throw 'Function deployment requires explicit notification release approval.' }
$project = 'ndrusywvceojsoirhkhl'
$repo = Split-Path -Parent $PSScriptRoot
$node22 = Join-Path (Split-Path -Parent $repo) 'verification-runtimes-20261113\node_modules\node-win-x64\bin\node.exe'
$cli = Join-Path $repo 'node_modules\.bin\supabase.cmd'
$tokenFile = Join-Path $env:LOCALAPPDATA 'InterviewIQ\management\supabase-token.dpapi'
$ptr = [IntPtr]::Zero
$secure = $null
$old = @{}
foreach ($name in @('SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_REF','INTERVIEWIQ_TELEGRAM_CONFIRMED')) {
  $old[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
  if (-not [IO.File]::Exists($node22) -or -not [IO.File]::Exists($cli)) { throw 'Pinned notification tools unavailable.' }
  $secure = ConvertTo-SecureString -String ([IO.File]::ReadAllText($tokenFile))
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $env:SUPABASE_ACCESS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $env:SUPABASE_PROJECT_REF = $project
  $env:INTERVIEWIQ_TELEGRAM_CONFIRMED = if ($ConfirmedNotificationRelease) { "$($project):telegram-notify" } else { '' }
  if (-not $FunctionsOnly) {
    $arguments = @((Join-Path $PSScriptRoot 'migrate-telegram-notify.mjs'))
    if ($ConfirmedNotificationRelease) { $arguments += '--apply' }
    & $node22 @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Notification migration/inspection did not complete. Reconcile state before retry.' }
  }
  if (-not $ConfirmedNotificationRelease) { return }
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $log = & $cli functions deploy send-notify-test --workdir $repo --project-ref $project --no-verify-jwt --use-api --yes 2>&1
    $exitCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousPreference }
  # Do not print CLI logs: errors can embed credential-bearing request details.
  if ($exitCode -ne 0) { throw 'send-notify-test deployment failed; the migration may already be committed.' }
  Write-Output 'Approved send-notify-test deployed. No unrelated function, engine, contract, binding or message changed.'
} catch {
  Write-Output 'Notification rollout stopped. Inspect metadata before retry; no credential or private response printed.'
  exit 1
} finally {
  foreach ($name in $old.Keys) { [Environment]::SetEnvironmentVariable($name, $old[$name], 'Process') }
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if ($secure) { $secure.Dispose() }
}

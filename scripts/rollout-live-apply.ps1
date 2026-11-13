# Execute only the explicitly approved expansion and two named Edge functions.
# DPAPI token is passed in the child's environment, never argv or output.
param([switch]$ConfirmedExpansion, [switch]$FunctionsOnly)
$ErrorActionPreference = "Stop"
if (-not $ConfirmedExpansion) { throw 'Explicit final production expansion approval required; pass -ConfirmedExpansion only after approval.' }
$project = "ndrusywvceojsoirhkhl"
$owner = "5f6bce44-1cc7-45d0-9429-f37e09cdf745"
$email = "gaurav.123337@gmail.com"
$repo = Split-Path -Parent $PSScriptRoot
$node22 = Join-Path (Split-Path -Parent $repo) "verification-runtimes-20261113\node_modules\node-win-x64\bin\node.exe"
$cli = Join-Path $repo "node_modules\.bin\supabase.cmd"
$tokenFile = Join-Path $env:LOCALAPPDATA "InterviewIQ\management\supabase-token.dpapi"
$ptr = [IntPtr]::Zero
$secure = $null
$old = @{}
foreach ($name in @('SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_REF','INTERVIEWIQ_ROLLOUT_CONFIRMED')) {
  $old[$name] = [Environment]::GetEnvironmentVariable($name,'Process')
}
try {
  if (-not [IO.File]::Exists($node22) -or -not [IO.File]::Exists($cli)) { throw 'Pinned rollout tools unavailable' }
  $secure = ConvertTo-SecureString -String ([IO.File]::ReadAllText($tokenFile))
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $env:SUPABASE_ACCESS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $env:SUPABASE_PROJECT_REF = $project
  $env:INTERVIEWIQ_ROLLOUT_CONFIRMED = "$($project):expand"
  if (-not $FunctionsOnly) {
    & $node22 (Join-Path $PSScriptRoot 'migrate-apply-tenants.mjs') --phase expand --owner-id $owner --owner-email $email --apply
    if ($LASTEXITCODE -ne 0) { throw 'Expansion failed; no function deploy attempted. Check transaction status before retry.' }
  }
  foreach ($function in @('apply-agent','send-notify-test')) {
    # PowerShell 5 turns native stderr progress into ErrorRecord under Stop.
    # Capture safely and judge the CLI exit code, not its output stream choice.
    $previousPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      $log = & $cli functions deploy $function --workdir $repo --project-ref $project --no-verify-jwt --use-api --yes 2>&1
      $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    foreach ($line in $log) {
      Write-Output (([string]$line) -replace 'sbp_[A-Za-z0-9]+','[redacted]')
    }
    if ($exitCode -ne 0) { throw "Deployment failed for $function after successful expansion; do not claim rollout completed." }
    Write-Output "Approved Edge function deployed: $function"
  }
  Write-Output 'Expansion and the two approved functions deployed. Engine mode, frontend, plan grants, messages and contract were not changed.'
} catch {
  Write-Output ('Rollout stopped: ' + ($_.Exception.Message -replace 'sbp_[A-Za-z0-9]+','[redacted]'))
  exit 1
} finally {
  foreach ($name in $old.Keys) { [Environment]::SetEnvironmentVariable($name,$old[$name],'Process') }
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if ($secure) { $secure.Dispose() }
}

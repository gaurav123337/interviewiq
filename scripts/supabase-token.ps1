# Local-only Supabase management credential storage for this Windows account.
# ConvertFrom-SecureString without a key uses Windows DPAPI, not plaintext.
param(
  [ValidateSet("Setup", "Status", "Inspect", "SelfTest")]
  [string]$Mode = "Setup",
  [string]$OwnerId,
  [string]$OwnerEmail
)

$ErrorActionPreference = "Stop"
$project = "ndrusywvceojsoirhkhl"
$storeDir = Join-Path $env:LOCALAPPDATA "InterviewIQ\management"
$storeFile = Join-Path $storeDir "supabase-token.dpapi"

function Set-PrivateDirectory([string]$Directory) {
  [void][IO.Directory]::CreateDirectory($Directory)
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $acl.SetOwner($sid)
  $acl.SetAccessRuleProtection($true, $false)
  $rule = New-Object Security.AccessControl.FileSystemAccessRule(
    $sid, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
  )
  $acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $Directory -AclObject $acl
}

function Test-ManagementToken([Security.SecureString]$Secure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) -match '^sbp_[A-Za-z0-9]+$'
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Write-EncryptedToken([string]$File, [Security.SecureString]$Secure) {
  $encrypted = ConvertFrom-SecureString -SecureString $Secure
  $temporary = $File + "." + [Guid]::NewGuid().ToString("N") + ".tmp"
  $backup = $temporary + ".backup"
  try {
    [IO.File]::WriteAllText($temporary, $encrypted, [Text.Encoding]::UTF8)
    if ([IO.File]::Exists($File)) {
      [IO.File]::Replace($temporary, $File, $backup)
    } else {
      [IO.File]::Move($temporary, $File)
    }
  } finally {
    if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
    if ([IO.File]::Exists($backup)) { [IO.File]::Delete($backup) }
  }
}

function Read-EncryptedToken([string]$File) {
  if (-not [IO.File]::Exists($File)) { throw "No saved token. Double-click setup-supabase-token.cmd first." }
  try {
    $secure = ConvertTo-SecureString -String ([IO.File]::ReadAllText($File, [Text.Encoding]::UTF8))
    if (-not (Test-ManagementToken $secure)) { $secure.Dispose(); throw "Invalid token" }
    return $secure
  } catch {
    throw "The saved token cannot be decrypted or is invalid. Run the setup helper again under the same Windows account."
  }
}

try {
  switch ($Mode) {
    "Setup" {
      Write-Host "InterviewIQ - secure Supabase token setup" -ForegroundColor Cyan
      Write-Host "1. Open https://supabase.com/dashboard/account/tokens"
      Write-Host "2. Generate a management personal access token (starts with sbp_)."
      Write-Host "3. Paste it below. Input is hidden. Do NOT paste it into chat."
      Write-Host "This saves locally only. It does not connect to Supabase or deploy anything."
      if ([IO.File]::Exists($storeFile)) {
        # Inspect existing ciphertext before offering replacement; approval is local.
        [void][IO.File]::ReadAllText($storeFile)
        if ((Read-Host "A token is already saved. Replace it? Type YES") -cne "YES") {
          Write-Host "Existing token unchanged."
          break
        }
      }
      $secure = Read-Host "Paste management token" -AsSecureString
      try {
        if (-not (Test-ManagementToken $secure)) {
          throw "That is not an sbp_ management token. Do not use a project anon, publishable, or service-role key."
        }
        Set-PrivateDirectory $storeDir
        Write-EncryptedToken $storeFile $secure
        $check = Read-EncryptedToken $storeFile
        $check.Dispose()
        Write-Host "Saved and verified securely for your Windows account." -ForegroundColor Green
        Write-Host "Return to ZCode and say: ready"
      } finally { $secure.Dispose() }
    }
    "Status" {
      $secure = Read-EncryptedToken $storeFile
      $secure.Dispose()
      Write-Host "Encrypted management token: saved, decryptable, valid format."
      Write-Host "Project target: $project"
      Write-Host "No network request or live change was made."
    }
    "Inspect" {
      if ($OwnerId -notmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$' -or
          $OwnerEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
        throw "Explicit verified owner UUID and email are required for read-only inspection."
      }
      $secure = Read-EncryptedToken $storeFile
      $ptr = [IntPtr]::Zero
      $oldToken = $env:SUPABASE_ACCESS_TOKEN
      $oldProject = $env:SUPABASE_PROJECT_REF
      try {
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $env:SUPABASE_ACCESS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        $env:SUPABASE_PROJECT_REF = $project
        $runner = Join-Path $PSScriptRoot "migrate-apply-tenants.mjs"
        & node $runner --owner-id $OwnerId --owner-email $OwnerEmail
        if ($LASTEXITCODE -ne 0) { throw "Read-only inspection failed. No migration was requested." }
      } finally {
        $env:SUPABASE_ACCESS_TOKEN = $oldToken
        $env:SUPABASE_PROJECT_REF = $oldProject
        if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        $secure.Dispose()
      }
    }
    "SelfTest" {
      # Synthetic test only: never reads or overwrites the real credential store.
      $testDir = Join-Path ([IO.Path]::GetTempPath()) ("interviewiq-dpapi-test-" + [Guid]::NewGuid().ToString("N"))
      $testFile = Join-Path $testDir "synthetic.dpapi"
      $synthetic = "sbp_" + [Guid]::NewGuid().ToString("N")
      $secure = ConvertTo-SecureString $synthetic -AsPlainText -Force
      try {
        Set-PrivateDirectory $testDir
        Write-EncryptedToken $testFile $secure
        if ([IO.File]::ReadAllText($testFile).Contains($synthetic)) { throw "Plaintext was stored" }
        $decoded = Read-EncryptedToken $testFile
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($decoded)
        try {
          if ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) -cne $synthetic) { throw "DPAPI roundtrip mismatch" }
        } finally {
          [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
          $decoded.Dispose()
        }
        Write-EncryptedToken $testFile $secure
        if (-not (Get-Acl -LiteralPath $testDir).AreAccessRulesProtected) { throw "Credential ACL is inherited" }
        Write-Host "PASS: DPAPI encryption, decryption, atomic replacement and private directory ACL."
      } finally {
        $secure.Dispose()
        $synthetic = $null
        if ([IO.Directory]::Exists($testDir)) { [IO.Directory]::Delete($testDir, $true) }
      }
    }
  }
} catch {
  # Generic store errors never include plaintext tokens or request headers.
  Write-Host ("Setup/inspection failed: " + $_.Exception.Message) -ForegroundColor Red
  exit 1
}

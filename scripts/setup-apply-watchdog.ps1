# setup-apply-watchdog - ONE-TIME (idempotent, safe to re-run) Windows setup
# for the self-healing apply rig.
#
# DESIGN (proven live 2026-09-28):
#   - The WATCHDOG must run INTERACTIVE as the logged-on user, never SYSTEM.
#     The watcher drives HEADED Chromium, which needs the user's desktop
#     session; a SYSTEM (session 0) watcher cannot open a browser at all -
#     and a zombie session-0 watcher holding watch.log blocks every new
#     start ("file in use by another process").
#   - A user-level scheduled task needs NO admin, so the primary setup below
#     works from any shell.
#   - The engine tees its own log (FREEBUFF_WATCH_LOG) via a node stream
#     (share-aware); the supervisor spawns node directly with no shell `>>`.
#
# Usage (no admin needed):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-apply-watchdog.ps1
#
# OPTIONAL admin extras (recommended but not required):
#   - never sleep/hibernate on AC (overnight runs need the PC powered)
#   - delete any leftover SYSTEM FreebuffApplyWatchdog task from an older
#     admin setup
#   powershell -ExecutionPolicy Bypass -File scripts\setup-apply-watchdog.ps1 -Admin

param([switch]$Admin)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot   # scripts/ -> repo root
$vbs = Join-Path $repo "scripts\hidden-run.vbs"
$shim = Join-Path $repo "scripts\ensure-apply-watcher.cmd"

# -- primary: user-level watchdog, every 15 min, no admin needed ----------
# Hidden launch (wscript -> hidden-run.vbs -> shim): no console flash every
# tick. scripts\setup-apply-tasks.ps1 (re)registers ALL THREE tasks hidden.
$tr = "wscript.exe `"$vbs`" `"$shim`""
schtasks /create /tn "FreebuffApplyWatchdogU" /sc minute /mo 15 /f /tr "$tr"
Write-Host "OK FreebuffApplyWatchdogU - user task, every 15 min, hidden (no admin needed)"
Write-Host "   supervisor: scripts\ensure-apply-watcher.js (starts watcher only when absent)"

if ($Admin) {
  # -- optional admin extras ------------------------------------------------
  powercfg /change standby-timeout-ac 0
  powercfg /change hibernate-timeout-ac 0
  Write-Host "OK power - never sleep/hibernate on AC (battery timeouts untouched)"

  # remove the discouraged SYSTEM variant if an older admin run created it
  schtasks /query /tn "FreebuffApplyWatchdog" 2>$null
  if ($LASTEXITCODE -eq 0) {
    schtasks /delete /tn "FreebuffApplyWatchdog" /f
    Write-Host "OK removed SYSTEM-variant task (headed Chromium cannot run in session 0)"
  }
  Write-Host "Done. Self-heal chain: logon trigger + 15-min user watchdog (+ always-on power)."
} else {
  Write-Host "TIP re-run with -Admin (once) to also disable sleep-on-AC for overnight runs."
}

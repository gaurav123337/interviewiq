# setup-apply-tasks - (re)registers the three apply-rig scheduled tasks so
# they run COMPLETELY HIDDEN. Each task now launches wscript.exe with
# hidden-run.vbs, which starts the cmd shim with window style 0 — a
# GUI-subsystem chain that opens no console at all. Before this, every
# minute-level tick flashed a cmd window open/closed on the desktop, and
# while a shim blocked (the listener used to block forever) the window
# stayed parked open.
#
# Idempotent (safe to re-run), user-level (no admin needed), same schedules
# as the original setup.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-apply-tasks.ps1

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot   # scripts/ -> repo root
$vbs = Join-Path $repo "scripts\hidden-run.vbs"

function Register-HiddenTask([string]$Name, [int]$EveryMinutes, [string]$Shim) {
  $target = Join-Path $repo "scripts\$Shim"
  $tr = "wscript.exe `"$vbs`" `"$target`""
  schtasks /create /tn $Name /sc minute /mo $EveryMinutes /f /tr "$tr" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "schtasks /create failed for $Name" }
  Write-Host "OK $Name - every $EveryMinutes min, hidden (wscript -> hidden-run.vbs -> $Shim)"
}

Register-HiddenTask "FreebuffApplyListen"    1  "listen-watchdog.cmd"
Register-HiddenTask "FreebuffApplyWatchdogU" 15 "ensure-apply-watcher.cmd"
Register-HiddenTask "FreebuffApplyRelay"     5  "start-apply-relay.cmd"

Write-Host "Done. No windows flash; the engine's only UI is the app (Apply mode panel)."

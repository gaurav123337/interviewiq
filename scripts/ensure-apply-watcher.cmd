@echo off
rem ensure-apply-watcher.cmd - shim for the user-level watchdog task:
rem starts the Node supervisor (which starts the watcher only when absent).
rem Node resolves from machine PATH (C:\nvm4w\nodejs is machine-wide).
"C:\nvm4w\nodejs\node.exe" "%~dp0ensure-apply-watcher.js"

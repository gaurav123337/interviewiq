@echo off
rem start-apply-relay.cmd - shim for the FreebuffApplyRelay scheduled task:
rem starts the residential-exit relay Chromium (CDP on 127.0.0.1:9222),
rem idempotent - exits immediately when the relay is already up.
"C:\nvm4w\nodejs\node.exe" "%~dp0start-apply-relay.js"

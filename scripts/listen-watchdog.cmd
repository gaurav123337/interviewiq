@echo off
rem FreebuffApplyListen watchdog - every minute. All logic lives in
rem listen-watchdog.js: it honours the apply-mode kill switch (Off kills the
rem listener + every other engine process and respawns NOTHING until the
rem switch is back on), then starts the listener DETACHED when it is down -
rem so no cmd window stays parked open on the desktop anymore.
cd /d "C:\Users\Admin\OneDrive\Desktop\Coding\AI_Interviewr_tool"
"C:\nvm4w\nodejs\node.exe" "%~dp0listen-watchdog.js" >> freebuff-apply-reports\listen-watchdog.log 2>&1

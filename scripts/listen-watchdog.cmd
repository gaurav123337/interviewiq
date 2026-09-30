@echo off
rem FreebuffApplyListen watchdog — every minute: start the Telegram command
rem listener unless one is already running (the ONLOGON trigger needs admin;
rem this achieves persistence without elevation, like FreebuffApplyWatchdogU)
cd /d "C:\Users\Admin\OneDrive\Desktop\Coding\AI_Interviewr_tool"
wmic process where "name='node.exe'" get commandline 2>nul | findstr /C:"auto-apply-jobs.js --listen" >nul
if %errorlevel%==0 exit /b 0
node scripts/auto-apply-jobs.js --listen >> freebuff-apply-reports\listen.log 2>&1

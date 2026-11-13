@echo off
powershell.exe -NoProfile -File "%~dp0supabase-token.ps1" -Mode Setup
if errorlevel 1 echo Setup did not complete. Follow the message above or ask for help.
pause

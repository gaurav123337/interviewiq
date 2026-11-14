@echo off
rem FreebuffApplySessions — hourly session watchdog (probe + stamp + DM on new expiry), logs here
cd /d "%~dp0.."
if not exist freebuff-apply-reports mkdir freebuff-apply-reports
node scripts/auto-apply-jobs.js --sessions --legacy-owner >> freebuff-apply-reports\sessions.log 2>&1

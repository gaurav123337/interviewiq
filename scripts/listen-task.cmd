@echo off
rem FreebuffApplyListen — Telegram command listener (resolve review rows from chat)
cd /d "%~dp0.."
if not exist freebuff-apply-reports mkdir freebuff-apply-reports
node scripts/auto-apply-jobs.js --listen --legacy-owner >> freebuff-apply-reports\listen.log 2>&1

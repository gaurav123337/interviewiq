@echo off
rem FreebuffApplyListen — Telegram command listener (resolve review rows from chat)
cd /d "C:\Users\Admin\OneDrive\Desktop\Coding\AI_Interviewr_tool"
node scripts/auto-apply-jobs.js --listen >> freebuff-apply-reports\listen.log 2>&1

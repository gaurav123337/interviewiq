@echo off
rem FreebuffApplyDigest — weekly Telegram digest (Mon 09:00), logs here
cd /d "C:\Users\Admin\OneDrive\Desktop\Coding\AI_Interviewr_tool"
node scripts/auto-apply-jobs.js --digest >> freebuff-apply-reports\digest.log 2>&1

@echo off
rem FreebuffApplySessions — hourly session watchdog (probe + stamp + DM on new expiry), logs here
cd /d "C:\Users\Admin\OneDrive\Desktop\Coding\AI_Interviewr_tool"
node scripts/auto-apply-jobs.js --sessions >> freebuff-apply-reports\sessions.log 2>&1

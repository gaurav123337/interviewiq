@echo off
rem FreebuffApplyDigest — weekly Telegram digest (Mon 09:00), logs here.
rem First the employer-behavior scrape (views/responses per board → the
rem digest's fit-band learning section + the judge prior); then the digest.
rem cmd continues to the next line even if the scrape exits non-zero, so a
rem broken tracker can never stop the digest from sending.
cd /d "C:\Users\Admin\OneDrive\Desktop\Coding\AI_Interviewr_tool"
node scripts/auto-apply-jobs.js --outcomes >> freebuff-apply-reports\digest.log 2>&1
node scripts/auto-apply-jobs.js --digest >> freebuff-apply-reports\digest.log 2>&1

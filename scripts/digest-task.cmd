@echo off
rem FreebuffApplyDigest — weekly Telegram digest (Mon 09:00), logs here.
rem First the employer-behavior scrape (views/responses per board → the
rem digest's fit-band learning section + the judge prior); then the digest.
rem cmd continues to the next line even if the scrape exits non-zero, so a
rem broken tracker can never stop the digest from sending.
cd /d "%~dp0.."
if not exist freebuff-apply-reports mkdir freebuff-apply-reports
node scripts/auto-apply-jobs.js --outcomes --legacy-owner >> freebuff-apply-reports\digest.log 2>&1
node scripts/auto-apply-jobs.js --digest --legacy-owner >> freebuff-apply-reports\digest.log 2>&1

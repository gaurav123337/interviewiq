/* Job feed auto-refresh — pg_cron scheduling (jobs-fetch Edge Function).
   Deno.cron is not supported on the Supabase edge runtime, so the scheduled
   refresh lives here: pg_cron fires an HTTP POST to jobs-fetch every 6
   hours, authenticated with the JOBS_FETCH_SECRET shared secret (the same
   one the function accepts via x-jobs-secret for manual/cron runs) — no
   signed-in session needed.

   Steps:
   1. Set the JOBS_FETCH_SECRET function secret (Edge Functions → Secrets)
      to a random value — the function refuses the x-jobs-secret path
      without it.
   2. Replace <YOUR_JOBS_FETCH_SECRET> below with that same value.
   3. Replace <YOUR_ANON_KEY> with the project's anon (publishable) key.
   4. Run this file. Verify with:
      select jobid, jobname, schedule, active from cron.job where jobname = 'hourly-jobs-fetch';
   Idempotent — re-running replaces the schedule. */

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('6h-jobs-fetch')
where exists (select 1 from cron.job where jobname = '6h-jobs-fetch');

select cron.schedule('6h-jobs-fetch', '0 */6 * * *', $$
  select net.http_post(
    url := 'https://ndrusywvceojsoirhkhl.supabase.co/functions/v1/jobs-fetch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_ANON_KEY>',
      'x-jobs-secret', '<YOUR_JOBS_FETCH_SECRET>'
    ),
    body := '{}'::jsonb
  )
$$);

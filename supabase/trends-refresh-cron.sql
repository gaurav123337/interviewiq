/* Weekly market-signal sweep — pg_cron scheduling (Trends-Refresh Edge
   Function). Every Monday 02:00 UTC this re-counts skill mentions in the job
   corpus, blends npm/GitHub signals, stores skill_signals, and emits
   admin-gated structural proposals.

   Steps:
   1. Deploy the function first:
      supabase functions deploy trends-refresh
   2. Set the TRENDS_REFRESH_SECRET function secret (Edge Functions →
      trends-refresh → Secrets) to a random value — the sweep refuses to run
      without it, so only the cron (or an admin JWT) can trigger it.
   3. Replace <YOUR_TRENDS_SECRET> below with that same value.
   4. Replace <YOUR_ANON_KEY> with the project's anon (publishable) key.
   5. Run this file. Verify with:
      select jobid, jobname, schedule, active from cron.job where jobname = 'weekly-trends-refresh';
   Idempotent — re-running replaces the schedule. */

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('weekly-trends-refresh')
where exists (select 1 from cron.job where jobname = 'weekly-trends-refresh');

select cron.schedule('weekly-trends-refresh', '0 2 * * 1', $$
  select net.http_post(
    url := 'https://ndrusywvceojsoirhkhl.supabase.co/functions/v1/trends-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_ANON_KEY>',
      'x-trends-secret', '<YOUR_TRENDS_SECRET>'
    ),
    body := '{}'::jsonb
  )
$$);

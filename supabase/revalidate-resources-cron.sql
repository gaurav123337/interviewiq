/* Weekly resource re-validation — pg_cron scheduling (Revalidate-Resources
   Edge Function). A clean site can go bad later; every Sunday 03:00 UTC this
   re-runs the guard over approved community resources and auto-quarantines
   failures.

   Steps:
   1. Deploy the function first:
      supabase functions deploy revalidate-resources
   2. Set the REVALIDATE_RESOURCES_SECRET function secret (Edge Functions →
      revalidate-resources → Secrets) to a random value — the sweep refuses to
      run without it, so only the cron (or an admin JWT) can trigger it.
   3. Replace <YOUR_REVALIDATE_SECRET> below with that same value.
   4. Replace <YOUR_ANON_KEY> with the project's anon (publishable) key.
   5. Run this file. Verify with:
      select jobid, jobname, schedule, active from cron.job where jobname = 'weekly-resource-revalidation';
   Idempotent — re-running replaces the schedule. */

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('weekly-resource-revalidation')
where exists (select 1 from cron.job where jobname = 'weekly-resource-revalidation');

select cron.schedule('weekly-resource-revalidation', '0 3 * * 0', $$
  select net.http_post(
    url := 'https://ndrusywvceojsoirhkhl.supabase.co/functions/v1/revalidate-resources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_ANON_KEY>',
      'x-revalidate-secret', '<YOUR_REVALIDATE_SECRET>'
    ),
    body := '{}'::jsonb
  )
$$);

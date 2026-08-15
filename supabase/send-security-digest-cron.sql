/* Monday admin digest — pg_cron scheduling (Send-Security-Digest Edge
   Function). Every Monday 09:00 UTC the owner + admins get one email: top
   market movers, pending structural proposals, and auto-quarantined resources.

   Steps:
   1. Deploy the function first:
      supabase functions deploy send-security-digest
   2. Set the SECURITY_DIGEST_SECRET function secret (Edge Functions →
      send-security-digest → Secrets) to a random value — the digest refuses to
      run without it, so only the cron (or an admin JWT) can trigger it.
   3. The digest emails need RESEND_API_KEY (function secret) to actually send.
   4. Replace <YOUR_SECURITY_SECRET> below with the same value.
   5. Replace <YOUR_ANON_KEY> with the project's anon (publishable) key.
   6. Run this file. Verify with:
      select jobid, jobname, schedule, active from cron.job where jobname = 'monday-security-digest';
   Idempotent — re-running replaces the schedule. */

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('monday-security-digest')
where exists (select 1 from cron.job where jobname = 'monday-security-digest');

select cron.schedule('monday-security-digest', '0 9 * * 1', $$
  select net.http_post(
    url := 'https://ndrusywvceojsoirhkhl.supabase.co/functions/v1/send-security-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_ANON_KEY>',
      'x-security-secret', '<YOUR_SECURITY_SECRET>'
    ),
    body := '{}'::jsonb
  )
$$);

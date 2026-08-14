/* Weekly recommendations digest — pg_cron scheduling (Send-Recommendations-Digest
   Edge Function).

   Deno.cron is not supported on the Supabase edge runtime, so the Monday
   08:00 UTC send is scheduled here: pg_cron fires an HTTP POST to the
   send-recommendations-digest function with an EMPTY body, which tells the
   function to run its broadcast path (every user with a synced uploaded
   resume → their top-3 company picks email).

   Run in the Supabase SQL editor (or via the management API). Steps:

   1. Deploy the function first:
      supabase functions deploy send-recommendations-digest
   2. Set the RECS_DIGEST_SECRET function secret (Edge Functions →
      send-recommendations-digest → Secrets) to a random value — the broadcast
      path refuses to run without it, so only the cron can trigger mass mail.
   3. Replace <YOUR_RECS_DIGEST_SECRET> below with that same value.
   4. Replace <YOUR_ANON_KEY> with the project's anon (publishable) key.
   5. Run this file. Verify with:
      select jobid, jobname, schedule, active from cron.job where jobname = 'weekly-recommendations-digest';

   The broadcast still needs RESEND_API_KEY (function secret) to actually
   send — until then it answers sent:false with a clear reason. */

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('weekly-recommendations-digest')
where exists (select 1 from cron.job where jobname = 'weekly-recommendations-digest');

select cron.schedule('weekly-recommendations-digest', '0 8 * * 1', $$
  select net.http_post(
    url := 'https://ndrusywvceojsoirhkhl.supabase.co/functions/v1/send-recommendations-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_ANON_KEY>',
      'x-apply-secret', '<YOUR_RECS_DIGEST_SECRET>'
    ),
    body := '{}'::jsonb
  )
$$);

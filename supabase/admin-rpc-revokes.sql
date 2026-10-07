/* admin-rpc-revokes — close the PUBLIC execute grant on admin-only RPCs.

   Postgres grants EXECUTE on every new function to PUBLIC, and Supabase's
   client roles inherit it, so an admin RPC with no REVOKE is callable by
   anyone holding the publishable key that ships in the app bundle — no
   sign-in required. Probed against the live project with that key (GET
   /rest/v1/rpc/<name>), these returned real data to an anonymous visitor:

     admin_list_apply_results   36 KB of the owner's application history
     admin_pending_proposals    14 KB of internal trend proposals
     admin_list_user_notify     user emails + Telegram chat ids + token prefixes
     admin_get_skill_strikes    the engine's hard-reject skill list
     admin_get_apply_config     apply mode + cloud endpoint
     admin_mfa_enforced         admin MFA policy flag
     admin_list_job_sites       full registry  (fixed in job-sites-probation.sql)
     job_sites / job_site_runs  the tables themselves (fixed there too)

   This file closes the RPC half with grants only — no function body changes,
   so nothing about the signed-in experience changes. The remaining hardening
   (an in-body `is_admin()` guard, so a signed-in free user cannot read them
   either) is tracked separately: admin_get_apply_config,
   admin_get_notify_config, admin_get_skill_strikes, admin_list_apply_results,
   admin_list_credentials, admin_list_job_reviews, admin_list_judge_exemplars,
   admin_apply_outcome_digest, admin_engine_state, admin_engine_events,
   admin_login_status, admin_run_status, admin_resolve_job_review (a WRITE),
   admin_user_usage, admin_user_apply_rows, admin_user_review_rows,
   admin_user_notify_row, admin_list_user_notify.

   Idempotent: safe to re-run. Apply after the files that create these
   functions (SQL is applied manually — SQL editor, or
   `npx supabase db query --linked --file supabase/admin-rpc-revokes.sql`). */

revoke execute on function public.admin_list_apply_results(int) from anon, public;
grant execute on function public.admin_list_apply_results(int) to authenticated, service_role;

revoke execute on function public.admin_pending_proposals() from anon, public;
grant execute on function public.admin_pending_proposals() to authenticated, service_role;

revoke execute on function public.admin_list_user_notify() from anon, public;
grant execute on function public.admin_list_user_notify() to authenticated, service_role;

revoke execute on function public.admin_get_skill_strikes() from anon, public;
grant execute on function public.admin_get_skill_strikes() to authenticated, service_role;

revoke execute on function public.admin_get_apply_config() from anon, public;
grant execute on function public.admin_get_apply_config() to authenticated, service_role;

revoke execute on function public.admin_mfa_enforced() from anon, public;
grant execute on function public.admin_mfa_enforced() to authenticated, service_role;

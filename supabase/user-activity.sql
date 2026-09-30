/* #137 — per-user activity drawer (Admin → Users → 📊 Activity):
   the user's usage timeline + their Telegram binding, alongside the
   SHARED apply-engine history (the local engine runs as the owner, so
   apply_results/job_apply_reviews carry no user_id — they are global)
   and the audit trail rows issued BY this user. All admin-gated. */

create or replace function public.admin_user_usage(p_user uuid, p_limit int default 40)
returns table (kind text, meta jsonb, created_at timestamptz)
language sql security definer set search_path = public as $$
  select e.kind, e.meta, e.created_at
  from public.usage_events e
  where e.user_id = p_user
  order by e.created_at desc
  limit least(p_limit, 200);
$$;

create or replace function public.admin_user_apply_rows(p_limit int default 30)
returns table (site_host text, job_url text, title text, company text, result text, detail text, fit int, created_at timestamptz)
language sql security definer set search_path = public as $$
  select r.site_host, r.job_url, r.title, r.company, r.result, r.detail, r.fit, r.created_at
  from public.apply_results r
  order by r.created_at desc
  limit least(p_limit, 100);
$$;

create or replace function public.admin_user_review_rows()
returns table (job_url text, title text, company text, status text, reason text, fit int, created_at timestamptz, resolved_at timestamptz)
language sql security definer set search_path = public as $$
  select v.job_url, v.title, v.company, v.status, v.reason, v.fit, v.created_at, v.resolved_at
  from public.job_apply_reviews v
  order by v.created_at desc
  limit 50;
$$;

create or replace function public.admin_user_notify_row(p_user uuid)
returns table (chat_id text, token_prefix text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select n.chat_id, left(n.bot_token, 8), n.updated_at
  from public.user_notify_config n
  where n.user_id = p_user;
$$;

revoke execute on function public.admin_user_usage(uuid, int) from anon, public;
revoke execute on function public.admin_user_apply_rows(int) from anon, public;
revoke execute on function public.admin_user_review_rows() from anon, public;
revoke execute on function public.admin_user_notify_row(uuid) from anon, public;
grant execute on function public.admin_user_usage(uuid, int) to authenticated;
grant execute on function public.admin_user_apply_rows(int) to authenticated;
grant execute on function public.admin_user_review_rows() to authenticated;
grant execute on function public.admin_user_notify_row(uuid) to authenticated;

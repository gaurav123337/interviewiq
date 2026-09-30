/* #130 — test-fire the Telegram notify config: sends a confirmation DM
   whose body carries the current weekly digest, so the owner verifies the
   bot token, chat id AND the digest format in one shot. pg_net is async:
   http_post returns a request id, the response lands in net._http_response
   — we poll briefly and report the true delivery status. */

create or replace function public.admin_test_notify_config()
returns text language plpgsql security definer set search_path = public, net as $$
declare
  cfg record;
  req bigint;
  sc int := null;
  content text := null;
  digest_line text;
  msg text;
  i int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select chat_id, bot_token into cfg from public.notify_config where key = 'telegram';
  if cfg.chat_id is null or cfg.bot_token is null then
    return 'no config — save a bot token and chat id first';
  end if;

  msg := E'\xe2\x9c\x85 InterviewIQ notify test \xe2\x80\x94 Telegram pings are live.\n\n\xe0\xa4\x89 Last 7 days (engine \xe2\x86\x92 your verdicts):\n';
  for digest_line in
    select d.site_host || ': engine ' ||
      chr(9971)::text || coalesce(d.submitted, 0) || ' ' ||
      chr(9203)::text || coalesce(d.needs_review, 0) || ' ' ||
      chr(9209)::text || coalesce(d.skipped, 0) || ' ' ||
      chr(10007)::text || coalesce(d.errors, 0) ||
      ' \xe2\x80\x94 you: ' ||
      chr(9989)::text || coalesce(d.owner_applied, 0) || ' ' ||
      chr(10060)::text || coalesce(d.owner_dismissed, 0) || ' ' ||
      chr(128683)::text || coalesce(d.owner_closed, 0)
    from public.admin_apply_weekly_digest() d
    where d.site_host is not null
  loop
    msg := msg || digest_line || E'\n';
  end loop;
  if length(msg) = length(E'\xe2\x9c\x85 InterviewIQ notify test \xe2\x80\x94 Telegram pings are live.\n\n\xe0\xa4\x89 Last 7 days (engine \xe2\x86\x92 your verdicts):\n') then
    msg := msg || '(no engine activity yet this week)';
  end if;
  msg := msg || E'\nNeeds-review rows will ping this chat the moment the engine queues them.';

  req := net.http_post(
    url := 'https://api.telegram.org/bot' || cfg.bot_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('chat_id', cfg.chat_id, 'text', left(msg, 3900))
  );

  for i in 1..20 loop
    perform pg_sleep(0.5);
    select r.status_code, r.content::text into sc, content
      from net._http_response r where r.id = req;
    exit when sc is not null;
  end loop;

  if sc is null then return 'timeout — Telegram did not answer in 10s'; end if;
  if sc = 200 then return 'sent'; end if;
  return 'error ' || sc || ': ' || left(coalesce(content, ''), 200);
end $$;

revoke execute on function public.admin_test_notify_config() from anon, public;
grant execute on function public.admin_test_notify_config() to authenticated;

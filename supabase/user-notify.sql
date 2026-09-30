/* #135 — Telegram binding becomes PER-USER (was admin-only notify_config)
   and gated on the auto-apply/Platinum entitlement (enforced server-side in
   the send-notify-test function). Each signed-in user stores their own bot
   token + chat id; RLS scopes every operation to auth.uid(). The local
   engine (which runs as the owner) resolves its notify config from the
   per-user rows FIRST, falling back to the legacy admin row. */

create table if not exists public.user_notify_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id text,
  bot_token text,
  updated_at timestamptz default now()
);

alter table public.user_notify_config enable row level security;

drop policy if exists "user notify own" on public.user_notify_config;
create policy "user notify own" on public.user_notify_config
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

/* admins may read any row (support/debugging); writes stay self-only */
drop policy if exists "user notify admin read" on public.user_notify_config;
create policy "user notify admin read" on public.user_notify_config
  for select to authenticated
  using (public.is_admin());

/* ── the ENGINE's config resolution: the most recently-updated ENTITLED
      per-user row wins — admin bypass first (admins own no entitlements
      row — the #100 lesson), then platinum tier, then the auto_apply addon.
      A free user's saved binding simply never drives the engine. ── */
create or replace function public.engine_notify_config()
returns table (chat_id text, bot_token text, user_id uuid)
language sql security definer set search_path = public as $$
  select n.chat_id, n.bot_token, n.user_id
  from public.user_notify_config n
  left join public.entitlements e on e.user_id = n.user_id
  where exists (select 1 from public.app_admins a where a.email = (select email from public.profiles p where p.id = n.user_id))
     or (e.tier = 'platinum' and (e.expires_at is null or e.expires_at > now()))
     or e.addons->'auto_apply'->>'active' = 'true'
  order by n.updated_at desc
  limit 1;
$$;

revoke execute on function public.engine_notify_config() from anon, public;
grant execute on function public.engine_notify_config() to service_role;

/* migrate the owner's existing admin-row binding into their per-user row
   (idempotent — only fills a missing row) */
insert into public.user_notify_config (user_id, chat_id, bot_token)
select u.id, c.chat_id, c.bot_token
from public.notify_config c
join public.profiles p on p.email = 'gaurav.123337@gmail.com'
join auth.users u on u.id = p.id
where c.key = 'telegram' and c.chat_id is not null and c.bot_token is not null
on conflict (user_id) do nothing;

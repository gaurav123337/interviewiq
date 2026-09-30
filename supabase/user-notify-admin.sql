/* #136 — admin view of per-user Telegram bindings: who bound what, with a
   clear action (e.g. a user reports their chat is pinging someone else, or
   a revoked plan should stop receiving pings — clear = engine forgets). */

create or replace function public.admin_list_user_notify()
returns table (user_id uuid, email text, chat_id text, token_prefix text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select n.user_id, p.email, n.chat_id, left(n.bot_token, 8) as token_prefix, n.updated_at
  from public.user_notify_config n
  left join public.profiles p on p.id = n.user_id
  order by n.updated_at desc;
$$;

create or replace function public.admin_clear_user_notify(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.user_notify_config where user_id = p_user;
end $$;

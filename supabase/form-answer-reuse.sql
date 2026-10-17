/* #heal-reuse — form-answer memory savings, visible to the owner.
   Every time the engine FILLS a field straight from a remembered answer
   (instead of drafting it again or asking the AI), it touches that row here:
   reuse_count++ and last_used_at = now. The applications report renders the
   totals via admin_form_answer_stats() — "🧠 N remembered answers, reused
   M×" per site. Nothing else changes: engine_get/put_form_answer semantics
   are untouched (the touch is a separate, best-effort call). */

alter table public.form_answers add column if not exists reuse_count int not null default 0;
alter table public.form_answers add column if not exists last_used_at timestamptz;

/* engine increments the rows it actually reused this form — service role
   only, same gate as the other form-answer RPCs */
create or replace function public.engine_touch_form_answers(
  p_site_host text, p_field_keys text[]
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or auth.jwt() ->> 'role' = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_field_keys is null or cardinality(p_field_keys) = 0 then
    return;
  end if;
  update public.form_answers
     set reuse_count = reuse_count + 1, last_used_at = now()
   where site_host = p_site_host
     and field_key = any (p_field_keys);
end $$;

revoke execute on function public.engine_touch_form_answers(text, text[]) from anon, public;

/* admin view: per site — how many remembered answers exist, how many have
   ever been reused, and total reuse events (the AI-call/savings counter) */
create or replace function public.admin_form_answer_stats()
returns table (
  site_host text, answers bigint, reused bigint, total_reuses bigint,
  last_used timestamptz
) language sql security definer set search_path = public as $$
  select site_host,
         count(*) as answers,
         count(*) filter (where reuse_count > 0) as reused,
         coalesce(sum(reuse_count), 0) as total_reuses,
         max(last_used_at) as last_used
    from public.form_answers
   group by site_host
   order by total_reuses desc, answers desc;
$$;

grant execute on function public.admin_form_answer_stats() to authenticated;

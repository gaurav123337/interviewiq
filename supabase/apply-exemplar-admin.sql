/* #130 — exemplar management: the owner must be able to SEE what the judge
   has been taught and DELETE mistakes. admin_get_judge_exemplars already
   exists (latest 5 per kind) but the UI wants the FULL set with ids.
   Deletion is admin-only (the service-role seeding path keeps write-only). */

create unique index if not exists judge_exemplars_dedupe_idx
  on public.judge_exemplars (kind, left(lower(summary), 200));

create or replace function public.admin_list_judge_exemplars()
returns table (
  id uuid, kind text, summary text, reason text, source_url text,
  created_at timestamptz
) language sql security definer set search_path = public as $$
  select e.id, e.kind, e.summary, e.reason, e.source_url, e.created_at
  from public.judge_exemplars e
  order by e.created_at desc
  limit 200;
$$;

create or replace function public.admin_delete_judge_exemplar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.judge_exemplars where id = p_id;
end $$;

revoke execute on function public.admin_list_judge_exemplars() from anon, public;
revoke execute on function public.admin_delete_judge_exemplar(uuid) from anon, public;
grant execute on function public.admin_list_judge_exemplars() to authenticated;
grant execute on function public.admin_delete_judge_exemplar(uuid) to authenticated;

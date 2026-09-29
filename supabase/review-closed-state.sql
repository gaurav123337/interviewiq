/* #127 — third outcome: the POSTING closed (no longer accepting
   applications). Unlike done (owner applied) and dismissed (owner not
   interested), closed says nothing about the owner's preferences — it
   must NOT teach the judge, it only stops the engine from retrying. */

drop function if exists public.admin_resolve_job_review(uuid, text);
create or replace function public.admin_resolve_job_review(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('done', 'dismissed', 'closed') then raise exception 'bad status'; end if;
  update public.job_apply_reviews
    set status = p_status, resolved_at = now()
    where id = p_id;
end $$;

revoke execute on function public.admin_resolve_job_review(uuid, text) from anon, public;

/* "Applied by User" (and Dismissed/Closed) history for the review queue.
   #160's dedupe covered only status='pending'; resolutions were invisible —
   the owner wanted to SEE what they already applied. Same listing shape as
   admin_list_job_reviews: one row per posting (newest variant wins via
   review_posting_key), with fit + posted_age_h so the ⏱ filter and chips
   behave exactly like the pending list. status is returned so the panel can
   badge done vs dismissed vs closed. */

create or replace function public.admin_list_resolved_job_reviews()
returns table (
  id uuid, site_host text, job_url text, title text, company text,
  form_url text, reason text, fit int, form_fields jsonb,
  status text, resolved_at timestamptz, created_at timestamptz,
  posted_age_h int
) language sql security definer set search_path = public as $$
  select id, site_host, job_url, title, company, form_url, reason, fit, form_fields,
         status, resolved_at, created_at, posted_age_h
  from (
    select r.*,
           row_number() over (
             partition by public.review_posting_key(r.job_url)
             order by coalesce(r.resolved_at, r.created_at) desc, r.id desc
           ) as rn
    from public.job_apply_reviews r
    where r.status in ('done', 'dismissed', 'closed')
  ) ranked
  where rn = 1
  order by resolved_at desc
  limit 150;
$$;

revoke execute on function public.admin_list_resolved_job_reviews() from anon, public;
grant execute on function public.admin_list_resolved_job_reviews() to authenticated;

/* Un-resolve: send a mistakenly resolved posting back to pending. The owner
   fat-fingers ✓ Applied occasionally; the row must not stay "applied" forever.
   Variant-wide like the resolver (#160): the posting key admits twins, and an
   un-resolved twin that re-pends brings its siblings back to the queue with it
   — otherwise the panel says "un-done" while its identical-looking twin
   stays applied. resolved_at resets ONLY on re-resolve; created_at (before
   which the engine tried to reach the posting) stays untouched. */
create or replace function public.admin_unresolve_job_review(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
  declare v_key text;
  begin
    if not public.is_admin() then raise exception 'forbidden'; end if;
    update public.job_apply_reviews
      set status = 'pending', resolved_at = null
      where id = p_id
        and status in ('done', 'dismissed', 'closed');
    select public.review_posting_key(job_url) into v_key
      from public.job_apply_reviews where id = p_id;
    if v_key is not null and v_key <> '' then
      update public.job_apply_reviews r
        set status = 'pending', resolved_at = null
        where r.status in ('done', 'dismissed', 'closed')
          and r.id <> p_id
          and public.review_posting_key(r.job_url) = v_key;
    end if;
  end $$;

revoke execute on function public.admin_unresolve_job_review(uuid) from anon, public;
grant execute on function public.admin_unresolve_job_review(uuid) to authenticated;

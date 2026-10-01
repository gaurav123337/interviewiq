/* #160 — the 🚫 Closed button did not remove the row: the engine queued the
   SAME posting twice under URL variants (LinkedIn /jobs/view/<id> vs
   /jobs/view/<id>/, plus ?eBP=…&refId=…&trk=… tracking slabs), the resolver
   updated ONE id, and the identical-looking twin stayed pending — "the
   button does nothing". Two halves:

   1. admin_resolve_job_review folds the verdict into every still-pending
      VARIANT of the same posting — Applied/Not-interested/Closed on one
      row retires its twins (any resolve must cover the twins, or every
      button lies whenever a variant exists).
   2. admin_list_job_reviews returns ONE row per posting (newest variant
      wins), so duplicates already in the table vanish from the UI
      immediately — no data migration needed.

   The posting key normalizes scheme/www/trailing slash and strips only
   TRACKING params — real identifiers in the query (Hacker News ?id=…)
   are KEPT so two different hn jobs never collapse into one.

   idempotent: re-running changes nothing (drop + create). */

create or replace function public.review_posting_key(p_url text)
returns text language plpgsql immutable as $$
  declare u text; q text; keepq text := ''; part text;
  begin
    u := lower(btrim(coalesce(p_url, '')));
    u := regexp_replace(u, '^https?://', '');
    u := regexp_replace(u, '^www\.', '');
    q := substring(u from '\?(.*)$');
    if q is not null then
      u := regexp_replace(u, '\?.*$', '');
      foreach part in array string_to_array(q, '&') loop
        if part <> '' and part !~ '^(ebp|refid|trackingid|trk|gclid|fbclid|utm_[a-z0-9_]*)=' then
          keepq := keepq || (case when keepq = '' then '' else '&' end) || part;
        end if;
      end loop;
    end if;
    u := regexp_replace(u, '/+$', '');
    if keepq <> '' then u := u || '?' || keepq; end if;
    return u;
  end $$;

/* THE actual #160 root cause: the table's CHECK constraint predates the
   'closed' outcome — #127 taught the RESOLVER the new status but the table
   still rejected it, so every 🚫 Closed click threw and nothing was saved.
   Widen the check (drop + re-add, idempotent). */
alter table public.job_apply_reviews drop constraint if exists job_apply_reviews_status_check;
alter table public.job_apply_reviews
  add constraint job_apply_reviews_status_check
  check (status in ('pending', 'done', 'dismissed', 'closed'));

drop function if exists public.admin_resolve_job_review(uuid, text);
create or replace function public.admin_resolve_job_review(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
  declare v_key text;
  begin
    if not public.is_admin() then raise exception 'forbidden'; end if;
    if p_status not in ('done', 'dismissed', 'closed') then raise exception 'bad status'; end if;
    update public.job_apply_reviews
      set status = p_status, resolved_at = now()
      where id = p_id;
    -- fold the verdict into every still-pending VARIANT of the same posting
    select public.review_posting_key(job_url) into v_key from public.job_apply_reviews where id = p_id;
    if v_key is not null and v_key <> '' then
      update public.job_apply_reviews r
        set status = p_status, resolved_at = now()
        where r.status = 'pending'
          and r.id <> p_id
          and public.review_posting_key(r.job_url) = v_key;
    end if;
  end $$;

/* ONE row per posting: same normalized URL = one queue row (newest wins). */
drop function if exists public.admin_list_job_reviews();
create or replace function public.admin_list_job_reviews()
returns table (
  id uuid, site_host text, job_url text, title text, company text,
  form_url text, reason text, fit int, form_fields jsonb, created_at timestamptz
) language sql security definer set search_path = public as $$
  select id, site_host, job_url, title, company, form_url, reason, fit, form_fields, created_at
  from (
    select r.*,
           row_number() over (
             partition by public.review_posting_key(r.job_url)
             order by r.created_at desc, r.id desc
           ) as rn
    from public.job_apply_reviews r
    where r.status = 'pending'
  ) ranked
  where rn = 1
  order by created_at desc
  limit 100;
$$;

revoke execute on function public.review_posting_key(text) from anon, public;
revoke execute on function public.admin_resolve_job_review(uuid, text) from anon, public;
revoke execute on function public.admin_list_job_reviews() from anon, public;
grant execute on function public.admin_list_job_reviews() to authenticated;
grant execute on function public.admin_resolve_job_review(uuid, text) to authenticated;

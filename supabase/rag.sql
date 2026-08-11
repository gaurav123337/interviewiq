/* ------------------------------------------------------------------ */
/* RAG health — knowledge-base retrieval analytics                     */
/* ------------------------------------------------------------------ */
/* Every tutor/coach retrieval queues a usage_event of kind 'rag_event'
 * with meta: { q, hits, topSim, grounded, checked } (queued by
 * src/services/rag.ts). This RPC exposes the recent retrieval log to the
 * admin Quality center so product can see which queries the knowledge base
 * answers (grounded rate), how often retrieval comes up empty (empty rate)
 * and how confident the top hit was (avg top similarity). */

create or replace function public.admin_rag_health(max_rows integer default 40)
returns table (
  query text, hits bigint, top_sim double precision, grounded boolean, at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select e.meta->>'q' as query,
           coalesce((e.meta->>'hits')::bigint, 0) as hits,
           coalesce((e.meta->>'topSim')::double precision, 0) as top_sim,
           coalesce((e.meta->>'grounded')::boolean, false) as grounded,
           e.created_at as at
    from public.usage_events e
    where e.kind = 'rag_event' and e.meta->>'q' is not null and e.meta->>'q' <> ''
    order by e.created_at desc
    limit max_rows;
end $$;

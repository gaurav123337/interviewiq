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

/* Per-document breakdown — which uploaded PDF actually answers queries.
   meta.docs is an array of { id, sim } recorded per retrieval by the client;
   the client diffs this against pdf_documents to flag never-retrieved files. */
create or replace function public.admin_rag_documents()
returns table (
  document_id bigint, retrievals bigint, avg_sim double precision, last_seen timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select (d.value->>'id')::bigint as document_id,
           count(*) as retrievals,
           round(avg(coalesce((d.value->>'sim')::double precision, 0))::numeric, 3) as avg_sim,
           max(e.created_at) as last_seen
    from public.usage_events e
    cross join lateral jsonb_array_elements(coalesce(e.meta->'docs', '[]'::jsonb)) as d(value)
    where e.kind = 'rag_event'
    group by (d.value->>'id')::bigint
    order by retrievals desc;
end $$;

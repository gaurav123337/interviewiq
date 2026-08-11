/* ------------------------------------------------------------------ */
/* RAG health — knowledge-base retrieval analytics                     */
/* ------------------------------------------------------------------ */
/* Every tutor/coach retrieval queues a usage_event of kind 'rag_event'
 * with meta: { q, hits, topSim, grounded, checked } (queued by
 * src/services/rag.ts). This RPC exposes the recent retrieval log to the
 * admin Quality center so product can see which queries the knowledge base
 * answers (grounded rate), how often retrieval comes up empty (empty rate)
 * and how confident the top hit was (avg top similarity). */

drop function if exists public.admin_rag_health(integer);
create function public.admin_rag_health(max_rows integer default 40)
returns table (
  query text, hits bigint, top_sim double precision, grounded boolean,
  gate_rejects bigint, below_min bigint, at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select e.meta->>'q' as query,
           coalesce((e.meta->>'hits')::bigint, 0) as hits,
           coalesce((e.meta->>'topSim')::double precision, 0) as top_sim,
           coalesce((e.meta->>'grounded')::boolean, false) as grounded,
           coalesce((e.meta->>'gateRejects')::bigint, 0) as gate_rejects,
           coalesce((e.meta->>'belowMin')::bigint, 0) as below_min,
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

/* Keyless knowledge-base search — term overlap over chunk contents, no
   embeddings needed. Powers the offline coach's RAG fallback so a no-key
   user still gets KB-grounded replies + citations when the network is up. */
create or replace function public.search_pdf_chunks_lex(terms text[], match_count integer default 4)
returns table (document_id bigint, content text, score double precision)
language sql stable as $$
  select c.document_id, c.content,
         (select count(*) from unnest(terms) t where c.content ilike '%' || t || '%')::double precision as score
  from public.pdf_chunks c
  where exists (select 1 from unnest(terms) t where c.content ilike '%' || t || '%')
  order by score desc, c.document_id
  limit match_count;
$$;

/* Weekly RAG digest — last-7-days aggregates vs the previous 7 days, plus the
   top queries asked and top documents cited. Feeds the admin RAG health tab's
   weekly summary so product can see week-over-week grounding health at a glance. */
create or replace function public.admin_rag_weekly_digest()
returns table (
  total bigint, grounded bigint, empty bigint, avg_top_sim double precision,
  gate_rejects bigint, prev_total bigint, prev_grounded bigint,
  top_queries jsonb, top_docs jsonb
)
language plpgsql security definer set search_path = public as $$
declare
  w_start timestamptz := now() - interval '7 days';
  p_start timestamptz := now() - interval '14 days';
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select
      (select count(*) from public.usage_events where kind = 'rag_event' and created_at >= w_start)::bigint,
      (select count(*) from public.usage_events where kind = 'rag_event' and created_at >= w_start
         and coalesce((meta->>'grounded')::boolean, false))::bigint,
      (select count(*) from public.usage_events where kind = 'rag_event' and created_at >= w_start
         and coalesce((meta->>'hits')::bigint, 0) = 0)::bigint,
      (select round(avg(coalesce((meta->>'topSim')::double precision, 0))::numeric, 3)::double precision
         from public.usage_events where kind = 'rag_event' and created_at >= w_start),
      (select coalesce(sum(coalesce((meta->>'gateRejects')::bigint, 0)), 0)::bigint
         from public.usage_events where kind = 'rag_event' and created_at >= w_start),
      (select count(*) from public.usage_events where kind = 'rag_event'
         and created_at >= p_start and created_at < w_start)::bigint,
      (select count(*) from public.usage_events where kind = 'rag_event'
         and created_at >= p_start and created_at < w_start
         and coalesce((meta->>'grounded')::boolean, false))::bigint,
      (select coalesce(jsonb_agg(j), '[]'::jsonb) from (
         select jsonb_build_object('q', meta->>'q', 'n', count(*)) as j
         from public.usage_events
         where kind = 'rag_event' and meta->>'q' is not null and meta->>'q' <> '' and created_at >= w_start
         group by meta->>'q' order by count(*) desc limit 8) t),
      (select coalesce(jsonb_agg(j), '[]'::jsonb) from (
         select jsonb_build_object('id', (d.value->>'id')::bigint, 'n', count(*)) as j
         from public.usage_events e
         cross join lateral jsonb_array_elements(coalesce(e.meta->'docs', '[]'::jsonb)) as d(value)
         where e.kind = 'rag_event' and e.created_at >= w_start
         group by (d.value->>'id')::bigint order by count(*) desc limit 8) t);
end $$;

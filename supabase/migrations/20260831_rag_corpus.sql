-- 20260831_rag_corpus.sql — RAG corpus link + per-chunk embedding provenance (Phase 1, item 9)
--
-- Idempotent. Run in the Supabase SQL editor AFTER admin.sql and content-curation.sql
-- (this references public.content_items, public.pdf_documents and public.pdf_chunks,
-- which those files create).
--
-- What & why
--   1. Link a knowledge-base document back to the content_item it was indexed from,
--      via pdf_documents.content_item_id (decision D5). The old
--      content_items.rag_document_id is a UUID and could never hold a
--      pdf_documents.id (bigint) — that column is now DEPRECATED and left in place,
--      unused. content-index writes the link on pdf_documents instead, and the
--      curation UI reads it back with a reverse lookup.
--   2. Stamp each chunk with the embedding provider + model that produced it, and let
--      match_pdf_chunks filter by model, so a query embedded in one vector space is
--      never compared against chunks embedded in another (cross-provider corruption).
--      Existing chunks predate the columns and carry NULL model — they are correctly
--      excluded from a model-scoped query until re-indexed through the canonical path.

-- 1. Document → content_item link. ON DELETE SET NULL keeps a KB doc searchable even
--    if its source content_item is removed (grounding must never break on a dangling FK).
alter table public.pdf_documents
  add column if not exists content_item_id uuid references public.content_items (id) on delete set null;

create index if not exists idx_pdf_documents_content_item
  on public.pdf_documents (content_item_id);

-- 2. Per-chunk embedding provenance (host of the /embeddings base + the model name).
alter table public.pdf_chunks add column if not exists embedding_provider text;
alter table public.pdf_chunks add column if not exists embedding_model text;

-- 3. match_pdf_chunks gains an optional model filter. CREATE OR REPLACE cannot change a
--    function's argument list, so the 2-arg version must be dropped first, then the
--    3-arg version recreated. (Overloading instead would leave both signatures live.)
drop function if exists public.match_pdf_chunks(vector(1536), integer);

create or replace function public.match_pdf_chunks(
  query_embedding vector(1536),
  match_count integer default 5,
  p_model text default null
)
returns table (document_id bigint, content text, similarity double precision)
language sql stable security definer set search_path = public as $$
  select p.document_id, p.content, 1 - (p.embedding <=> query_embedding) as similarity
  from public.pdf_chunks p
  where p.embedding is not null
    and (p_model is null or p.embedding_model = p_model)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

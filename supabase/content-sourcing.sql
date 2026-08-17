-- Question-bank content sourcing (docs/question-bank-expansion.md, P1–P3).
-- Provenance columns: where each draft came from + enrichment metadata, so the
-- review inbox can attribute sources and the AI cleaner can mark its work.
-- scraper_sources.config carries per-source extractor options (headingDepth,
-- questionFromHeading, headingPrefix, groupAs) that the Admin form doesn't edit.
-- Idempotent — safe to run on any environment.

alter table public.published_questions
  add column if not exists source_id text,
  add column if not exists source_url text,
  add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists published_questions_source_id_idx
  on public.published_questions (source_id)
  where source_id is not null;

alter table public.scraper_sources
  add column if not exists config jsonb not null default '{}'::jsonb;

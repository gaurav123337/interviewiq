-- Content Curation Pipeline
-- Manages content sources, scraped items with quality scores, and source reputation.
-- Admin reviews content before it's served to users with source attribution.

-- ── Content Sources ──────────────────────────────────────────────────────
-- Configured URLs/domains that we scrape content from.
-- Each source has a domain reputation score that's manually set by admins.

CREATE TABLE IF NOT EXISTS content_sources (
  id              TEXT PRIMARY KEY,
  url             TEXT NOT NULL,
  domain          TEXT NOT NULL,                -- extracted from url
  name            TEXT NOT NULL,                -- display name e.g. "Medium - Engineering Blog"
  source_type     TEXT NOT NULL DEFAULT 'article',  -- article, tutorial, docs, video_transcript
  field_id        TEXT NOT NULL DEFAULT 'general',  -- maps to app fields
  enabled         BOOLEAN DEFAULT TRUE,
  domain_reputation  NUMERIC(3,1) DEFAULT 7.0,  -- 1-10 admin-set reputation score
  scrape_config   JSONB DEFAULT '{}',          -- custom selectors, headers, etc.
  last_scraped_at TIMESTAMPTZ,
  scrape_count    INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_sources_domain ON content_sources (domain);
CREATE INDEX IF NOT EXISTS idx_content_sources_enabled ON content_sources (enabled) WHERE enabled = TRUE;

ALTER TABLE content_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content sources admin" ON content_sources
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── Content Items ────────────────────────────────────────────────────────
-- Individual scraped content pieces with full quality metadata.

CREATE TABLE IF NOT EXISTS content_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id       TEXT REFERENCES content_sources(id) ON DELETE CASCADE,
  source_url      TEXT NOT NULL,                -- original URL
  source_name     TEXT NOT NULL,                -- display name at scrape time
  domain          TEXT NOT NULL,                -- source domain
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,                -- cleaned markdown/text
  summary         TEXT,                         -- AI-generated summary (2-3 sentences)
  author          TEXT,                         -- author name if available
  published_date  DATE,                         -- publication date if available
  
  -- Quality scoring (0-100 each, computed by LLM-as-Judge)
  quality_score       NUMERIC(5,2),             -- overall composite 0-100
  accuracy_score      NUMERIC(5,2),             -- factual accuracy 0-100
  relevance_score     NUMERIC(5,2),             -- relevance to interview prep 0-100
  depth_score         NUMERIC(5,2),             -- depth and completeness 0-100
  freshness_score     NUMERIC(5,2),             -- how current the info is 0-100
  credibility_score   NUMERIC(5,2),             -- source credibility 0-100
  
  -- Quality metadata
  quality_notes       TEXT,                     -- AI's reasoning for scores
  quality_model       TEXT,                     -- which model did the scoring
  quality_checked_at  TIMESTAMPTZ,             -- when quality was assessed
  
  -- Curation status
  status          TEXT DEFAULT 'pending',       -- pending, approved, rejected, archived
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,                         -- admin's review notes
  
  -- Classification
  field_id        TEXT NOT NULL DEFAULT 'general',
  tags            TEXT[] DEFAULT '{}',          -- content tags
  content_type    TEXT DEFAULT 'article',       -- article, tutorial, docs, answer, tip
  
  -- Dedup
  content_hash    TEXT,                         -- SHA-256 of title+content for dedup
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_items_source ON content_items (source_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items (status);
CREATE INDEX IF NOT EXISTS idx_content_items_domain ON content_items (domain);
CREATE INDEX IF NOT EXISTS idx_content_items_quality ON content_items (quality_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_content_items_field ON content_items (field_id);
CREATE INDEX IF NOT EXISTS idx_content_items_hash ON content_items (content_hash);

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

-- Public can read approved items
CREATE POLICY "content items public read" ON content_items
  FOR SELECT USING (status = 'approved');

-- Admins can do everything
CREATE POLICY "content items admin all" ON content_items
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── Content Stats (materialized per source) ──────────────────────────────
-- Updated periodically to avoid scanning content_items every time.

CREATE TABLE IF NOT EXISTS content_source_stats (
  source_id       TEXT PRIMARY KEY REFERENCES content_sources(id) ON DELETE CASCADE,
  total_scraped   INT DEFAULT 0,
  total_approved  INT DEFAULT 0,
  total_rejected  INT DEFAULT 0,
  avg_quality     NUMERIC(5,2),
  avg_accuracy    NUMERIC(5,2),
  last_quality_at TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content_source_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content stats admin" ON content_source_stats
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── Quality Thresholds (admin-configurable) ──────────────────────────────

CREATE TABLE IF NOT EXISTS content_quality_config (
  key             TEXT PRIMARY KEY,
  value           JSONB NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Default thresholds
INSERT INTO content_quality_config (key, value) VALUES
  ('thresholds', '{"minOverall": 60, "minAccuracy": 50, "minCredibility": 60, "autoApproveAbove": 85}'),
  ('scoring', '{"model": "gpt-4o-mini", "dimensions": ["accuracy", "relevance", "depth", "freshness", "credibility"]}')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE content_quality_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quality config admin" ON content_quality_config
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Content Curation Pipeline (idempotent — safe to re-run)
-- Manages content sources, scraped items with quality scores, and source reputation.

-- ── Content Sources ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_sources (
  id              TEXT PRIMARY KEY,
  url             TEXT NOT NULL,
  domain          TEXT NOT NULL,
  name            TEXT NOT NULL,
  source_type     TEXT NOT NULL DEFAULT 'article',
  field_id        TEXT NOT NULL DEFAULT 'general',
  enabled         BOOLEAN DEFAULT TRUE,
  domain_reputation  NUMERIC(3,1) DEFAULT 7.0,
  scrape_config   JSONB DEFAULT '{}',
  last_scraped_at TIMESTAMPTZ,
  scrape_count    INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_sources_domain ON content_sources (domain);
CREATE INDEX IF NOT EXISTS idx_content_sources_enabled ON content_sources (enabled) WHERE enabled = TRUE;

ALTER TABLE content_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "content sources admin" ON content_sources;
CREATE POLICY "content sources admin" ON content_sources
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── Content Items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id       TEXT REFERENCES content_sources(id) ON DELETE CASCADE,
  source_url      TEXT NOT NULL,
  source_name     TEXT NOT NULL,
  domain          TEXT NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  summary         TEXT,
  author          TEXT,
  published_date  DATE,
  quality_score       NUMERIC(5,2),
  accuracy_score      NUMERIC(5,2),
  relevance_score     NUMERIC(5,2),
  depth_score         NUMERIC(5,2),
  freshness_score     NUMERIC(5,2),
  credibility_score   NUMERIC(5,2),
  quality_notes       TEXT,
  quality_model       TEXT,
  quality_checked_at  TIMESTAMPTZ,
  status          TEXT DEFAULT 'pending',
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  field_id        TEXT NOT NULL DEFAULT 'general',
  tags            TEXT[] DEFAULT '{}',
  content_type    TEXT DEFAULT 'article',
  content_hash    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_items_source ON content_items (source_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items (status);
CREATE INDEX IF NOT EXISTS idx_content_items_domain ON content_items (domain);
CREATE INDEX IF NOT EXISTS idx_content_items_quality ON content_items (quality_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_content_items_field ON content_items (field_id);
CREATE INDEX IF NOT EXISTS idx_content_items_hash ON content_items (content_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_items_hash_unique ON content_items (content_hash) WHERE content_hash IS NOT NULL;

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "content items public read" ON content_items;
CREATE POLICY "content items public read" ON content_items
  FOR SELECT USING (status = 'approved');
DROP POLICY IF EXISTS "content items admin all" ON content_items;
CREATE POLICY "content items admin all" ON content_items
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── Content Stats ────────────────────────────────────────────────────────
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
DROP POLICY IF EXISTS "content stats admin" ON content_source_stats;
CREATE POLICY "content stats admin" ON content_source_stats
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── Quality Thresholds ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_quality_config (
  key             TEXT PRIMARY KEY,
  value           JSONB NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO content_quality_config (key, value) VALUES
  ('thresholds', '{"minOverall": 60, "minAccuracy": 50, "minCredibility": 60, "autoApproveAbove": 85}'),
  ('scoring', '{"model": "gpt-4o-mini", "dimensions": ["accuracy", "relevance", "depth", "freshness", "credibility"]}')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE content_quality_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quality config admin" ON content_quality_config;
CREATE POLICY "quality config admin" ON content_quality_config
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

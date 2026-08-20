/* Skill Roadmaps — database schema for the Skill Roadmap Explorer.
   Run this in the Supabase SQL Editor to create the tables + RLS policies. */

-- Skill Roadmaps (admin-managed)
CREATE TABLE IF NOT EXISTS skill_roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📚',
  band TEXT NOT NULL DEFAULT 'mid' CHECK (band IN ('junior','mid','senior','staff','principal','cto')),
  difficulty INTEGER NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  description TEXT NOT NULL,
  why TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tags TEXT[] DEFAULT '{}',
  aliases TEXT[] DEFAULT '{}',
  prerequisites TEXT[] DEFAULT '{}',
  learning_path TEXT[] DEFAULT '{}',
  resources JSONB DEFAULT '[]',
  estimated_hours INTEGER DEFAULT 40,
  quality_status TEXT DEFAULT 'draft' CHECK (quality_status IN ('draft','reviewed','published','archived')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  quality_notes TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free','pro')),
  published BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  starts INTEGER DEFAULT 0,
  completions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_skill_roadmaps_slug ON skill_roadmaps(slug);
CREATE INDEX IF NOT EXISTS idx_skill_roadmaps_published ON skill_roadmaps(published, quality_status);
CREATE INDEX IF NOT EXISTS idx_skill_roadmaps_tags ON skill_roadmaps USING GIN(tags);

-- Resource quality tracking
CREATE TABLE IF NOT EXISTS resource_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_url TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  quality_score INTEGER DEFAULT 50 CHECK (quality_score BETWEEN 0 AND 100),
  verified BOOLEAN DEFAULT false,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  clicks INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2),
  rating_count INTEGER DEFAULT 0,
  is_broken BOOLEAN DEFAULT false,
  is_outdated BOOLEAN DEFAULT false,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_quality_url ON resource_quality(resource_url);
CREATE INDEX IF NOT EXISTS idx_resource_quality_skill ON resource_quality(skill_id);

-- User skill progress
CREATE TABLE IF NOT EXISTS user_skill_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','bookmarked')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  hours_spent DECIMAL(5,1) DEFAULT 0,
  self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, skill_id)
);

-- RLS policies
ALTER TABLE skill_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skill_progress ENABLE ROW LEVEL SECURITY;

-- Public can read published roadmaps
CREATE POLICY "Public can read published roadmaps"
  ON skill_roadmaps FOR SELECT
  USING (published = true AND quality_status = 'published');

-- Admins can do everything with roadmaps
CREATE POLICY "Admins can manage roadmaps"
  ON skill_roadmaps FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public can read resource quality
CREATE POLICY "Public can read resource quality"
  ON resource_quality FOR SELECT
  USING (true);

-- Admins can manage resource quality
CREATE POLICY "Admins can manage resource quality"
  ON resource_quality FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Users can read their own progress
CREATE POLICY "Users can read own progress"
  ON user_skill_progress FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
  ON user_skill_progress FOR ALL
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER skill_roadmaps_updated_at
  BEFORE UPDATE ON skill_roadmaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER resource_quality_updated_at
  BEFORE UPDATE ON resource_quality
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_skill_progress_updated_at
  BEFORE UPDATE ON user_skill_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

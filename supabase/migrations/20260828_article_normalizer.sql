/* Article Normalizer — DB schema changes
   Run this in Supabase SQL Editor to add the new columns and tables. */

-- 1. Add extended fields to content_refined JSONB (no schema change needed,
--    the JSONB column already accepts any keys. We just document them here.)
--    Keys stored in content_refined:
--    - summary_ai: string
--    - keywords: string[]
--    - code_sections: { language, code, description }[]
--    - read_time_beginner: number (minutes)
--    - read_time_intermediate: number
--    - read_time_advanced: number

-- 2. User-scoped article notes (private per user, never shared)
CREATE TABLE IF NOT EXISTS user_article_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  original_url TEXT,
  original_text TEXT,
  title TEXT DEFAULT 'Untitled',
  normalized JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS policies — users can only see/modify their own notes
ALTER TABLE user_article_notes ENABLE ROW LEVEL SECURITY;

-- Users can read their own notes
CREATE POLICY "Users can view own article notes"
  ON user_article_notes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own notes
CREATE POLICY "Users can insert own article notes"
  ON user_article_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own notes
CREATE POLICY "Users can update own article notes"
  ON user_article_notes FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notes
CREATE POLICY "Users can delete own article notes"
  ON user_article_notes FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_article_notes_user_id
  ON user_article_notes (user_id, created_at DESC);

-- 5. Add the articleNormalize AI module config entry (if not exists)
-- This is handled by the app's ai_provider_config table, not SQL.
-- The module ID "articleNormalize" will be available in the Admin AI config UI.

/* Content Management System tables.
   Run this in the Supabase SQL editor to enable the admin Content CMS.
   
   Tables:
   - admin_testimonials: customer reviews (with A/B test variants)
   - admin_ads: sponsored banners and affiliate ads (with auto-rotation)
   - admin_resources: recommended resources with affiliate links
   - admin_tips: tip jar configuration
   - admin_content_analytics: click/view tracking for ads and resources
   - admin_banners: visual banner editor content */

-- ============================================================
-- 1. Testimonials (with A/B test variant support)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '👤',
  rating INT NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  highlight TEXT,
  variant TEXT NOT NULL DEFAULT 'all' CHECK (variant IN ('all', 'A', 'B')),
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials_public_read" ON admin_testimonials
  FOR SELECT USING (published = true);

CREATE POLICY "testimonials_admin_all" ON admin_testimonials
  FOR ALL USING (
    public.is_admin()
  );

-- ============================================================
-- 2. Advertisements (with auto-rotation support)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sponsor TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  bg_color TEXT NOT NULL DEFAULT '',
  text_color TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT 'landing-pricing'
    CHECK (position IN ('landing-hero', 'landing-pricing', 'landing-footer', 'sidebar', 'interstitial', 'banner')),
  start_date DATE,
  end_date DATE,
  published BOOLEAN NOT NULL DEFAULT true,
  auto_rotate BOOLEAN NOT NULL DEFAULT false,
  rotate_interval INT NOT NULL DEFAULT 5,
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_public_read" ON admin_ads
  FOR SELECT USING (published = true);

CREATE POLICY "ads_admin_all" ON admin_ads
  FOR ALL USING (
    public.is_admin()
  );

-- ============================================================
-- 3. Resources (affiliate links)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'book' CHECK (type IN ('book', 'course', 'tool')),
  description TEXT NOT NULL DEFAULT '',
  affiliate_url TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '📖',
  price TEXT NOT NULL DEFAULT '',
  badge TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resources_public_read" ON admin_resources
  FOR SELECT USING (published = true);

CREATE POLICY "resources_admin_all" ON admin_resources
  FOR ALL USING (
    public.is_admin()
  );

-- ============================================================
-- 4. Tip Jar config
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amounts INT[] NOT NULL DEFAULT '{5,15,30}',
  labels TEXT[] NOT NULL DEFAULT '{"☕ Coffee","🍕 Lunch","🎉 Celebration"}',
  descriptions TEXT[] NOT NULL DEFAULT '{"Buy me a coffee","Buy me lunch","Celebrating a new offer?"}',
  stripe_link TEXT NOT NULL DEFAULT '',
  buymeacoffee_link TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tips_public_read" ON admin_tips
  FOR SELECT USING (enabled = true);

CREATE POLICY "tips_admin_all" ON admin_tips
  FOR ALL USING (
    public.is_admin()
  );

-- ============================================================
-- 5. Banners (visual editor — rich banner content)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  cta_text TEXT NOT NULL DEFAULT '',
  cta_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  bg_gradient TEXT NOT NULL DEFAULT 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  text_color TEXT NOT NULL DEFAULT '#ffffff',
  position TEXT NOT NULL DEFAULT 'hero'
    CHECK (position IN ('hero', 'midpage', 'footer', 'popup')),
  published BOOLEAN NOT NULL DEFAULT true,
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banners_public_read" ON admin_banners
  FOR SELECT USING (published = true);

CREATE POLICY "banners_admin_all" ON admin_banners
  FOR ALL USING (
    public.is_admin()
  );

-- ============================================================
-- 6. Analytics (clicks + impressions + variant tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_content_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('ad', 'resource', 'testimonial', 'banner')),
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  variant TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_content_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_public_insert" ON admin_content_analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "analytics_admin_read" ON admin_content_analytics
  FOR SELECT USING (
    public.is_admin()
  );

-- ============================================================
-- 7. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_testimonials_sort ON admin_testimonials (sort_order);
CREATE INDEX IF NOT EXISTS idx_testimonials_published ON admin_testimonials (published);
CREATE INDEX IF NOT EXISTS idx_testimonials_variant ON admin_testimonials (variant);
CREATE INDEX IF NOT EXISTS idx_ads_published ON admin_ads (published);
CREATE INDEX IF NOT EXISTS idx_ads_position ON admin_ads (position);
CREATE INDEX IF NOT EXISTS idx_resources_sort ON admin_resources (sort_order);
CREATE INDEX IF NOT EXISTS idx_resources_published ON admin_resources (published);
CREATE INDEX IF NOT EXISTS idx_analytics_entity ON admin_content_analytics (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON admin_content_analytics (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_variant ON admin_content_analytics (variant);
CREATE INDEX IF NOT EXISTS idx_banners_position ON admin_banners (position);

-- ============================================================
-- 8. RPC for tracking clicks (increment counter atomically)
-- ============================================================
CREATE OR REPLACE FUNCTION track_content_click(p_entity_type TEXT, p_entity_id UUID, p_variant TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_entity_type = 'ad' THEN
    UPDATE admin_ads SET clicks = clicks + 1, updated_at = now() WHERE id = p_entity_id;
  ELSIF p_entity_type = 'resource' THEN
    UPDATE admin_resources SET clicks = clicks + 1, updated_at = now() WHERE id = p_entity_id;
  ELSIF p_entity_type = 'banner' THEN
    UPDATE admin_banners SET clicks = clicks + 1, updated_at = now() WHERE id = p_entity_id;
  END IF;

  INSERT INTO admin_content_analytics (entity_type, entity_id, event_type, variant)
  VALUES (p_entity_type, p_entity_id, 'click', p_variant);
END;
$$;

-- ============================================================
-- 9. RPC for tracking impressions
-- ============================================================
CREATE OR REPLACE FUNCTION track_content_impression(p_entity_type TEXT, p_entity_id UUID, p_variant TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_entity_type = 'ad' THEN
    UPDATE admin_ads SET impressions = impressions + 1, updated_at = now() WHERE id = p_entity_id;
  ELSIF p_entity_type = 'banner' THEN
    UPDATE admin_banners SET impressions = impressions + 1, updated_at = now() WHERE id = p_entity_id;
  END IF;

  INSERT INTO admin_content_analytics (entity_type, entity_id, event_type, variant)
  VALUES (p_entity_type, p_entity_id, 'impression', p_variant);
END;
$$;

-- ============================================================
-- 10. RPC for admin analytics summary (30 days)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_content_analytics_summary()
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  impressions BIGINT,
  clicks BIGINT,
  ctr NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    a.entity_type,
    a.entity_id,
    COUNT(*) FILTER (WHERE a.event_type = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE a.event_type = 'click') AS clicks,
    CASE
      WHEN COUNT(*) FILTER (WHERE a.event_type = 'impression') > 0
      THEN ROUND(COUNT(*) FILTER (WHERE a.event_type = 'click')::NUMERIC /
           COUNT(*) FILTER (WHERE a.event_type = 'impression') * 100, 1)
      ELSE 0
    END AS ctr
  FROM admin_content_analytics a
  WHERE a.created_at > now() - INTERVAL '30 days'
  GROUP BY a.entity_type, a.entity_id
  ORDER BY clicks DESC;
$$;

-- ============================================================
-- 11. RPC for A/B test results (testimonial variants)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_ab_test_results()
RETURNS TABLE (
  variant TEXT,
  impressions BIGINT,
  clicks BIGINT,
  ctr NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(a.variant, 'unknown') AS variant,
    COUNT(*) FILTER (WHERE a.event_type = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE a.event_type = 'click') AS clicks,
    CASE
      WHEN COUNT(*) FILTER (WHERE a.event_type = 'impression') > 0
      THEN ROUND(COUNT(*) FILTER (WHERE a.event_type = 'click')::NUMERIC /
           COUNT(*) FILTER (WHERE a.event_type = 'impression') * 100, 1)
      ELSE 0
    END AS ctr
  FROM admin_content_analytics a
  WHERE a.entity_type = 'testimonial'
    AND a.created_at > now() - INTERVAL '30 days'
  GROUP BY a.variant
  ORDER BY ctr DESC;
$$;

-- ============================================================
-- 12. RPC for daily analytics (last 30 days)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_daily_analytics()
RETURNS TABLE (
  day DATE,
  impressions BIGINT,
  clicks BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    a.created_at::date AS day,
    COUNT(*) FILTER (WHERE a.event_type = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE a.event_type = 'click') AS clicks
  FROM admin_content_analytics a
  WHERE a.created_at > now() - INTERVAL '30 days'
  GROUP BY day
  ORDER BY day;
$$;

-- ============================================================
-- 13. Seed data (safe to re-run — skips if data exists)
-- ============================================================
-- Testimonials
INSERT INTO admin_testimonials (name, role, company, avatar, rating, text, highlight, variant, sort_order)
SELECT * FROM (VALUES
  ('Priya Sharma', 'Senior Engineer', 'Google', '👩‍💻', 5, 'InterviewIQ helped me land my dream role at Google. The company-specific questions were spot-on.', 'company-specific questions were spot-on', 'all', 1),
  ('Marcus Chen', 'Frontend Lead', 'Stripe', '👨‍💻', 5, 'The AI coaching feedback after each answer was a game-changer for my preparation.', 'AI coaching feedback', 'A', 2),
  ('Sarah Williams', 'Product Manager', 'Meta', '👩‍💼', 4, 'Great tool for practicing system design interviews. The step-by-step breakdowns are excellent.', 'system design interviews', 'B', 3),
  ('David Park', 'Junior Developer', 'Startup', '👨‍💻', 5, 'As a fresher, this tool gave me the confidence to ace my first technical interview.', 'gave me the confidence', 'all', 4)
) AS v(name, role, company, avatar, rating, text, highlight, variant, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM admin_testimonials LIMIT 1);

-- Fix old emoji in existing rows
UPDATE admin_testimonials SET avatar = '👨‍💻' WHERE avatar = '🧑‍💻';

-- Banners
INSERT INTO admin_banners (title, subtitle, cta_text, cta_url, bg_gradient, position, published)
SELECT * FROM (VALUES
  ('Ace Your Next Interview', 'AI-powered practice tailored to your target company', 'Start Free →', '#', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'hero', true),
  ('Go Pro Today', 'Unlock unlimited AI coaching, hints, and solution walkthroughs', 'Upgrade to Pro', '#', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 'midpage', true)
) AS v(title, subtitle, cta_text, cta_url, bg_gradient, position, published)
WHERE NOT EXISTS (SELECT 1 FROM admin_banners LIMIT 1);

-- Ads (placeholder)
INSERT INTO admin_ads (title, description, sponsor, link_url, position, published)
SELECT * FROM (VALUES
  ('Interview Preparations Kit', 'Comprehensive study materials for tech interviews', 'InterviewIQ Pro', '#', 'landing-pricing', true)
) AS v(title, description, sponsor, link_url, position, published)
WHERE NOT EXISTS (SELECT 1 FROM admin_ads LIMIT 1);

-- Resources
INSERT INTO admin_resources (title, author, type, description, affiliate_url, icon, price, badge, sort_order)
SELECT * FROM (VALUES
  ('Cracking the Coding Interview', 'Gayle Laakmann McDowell', 'book', 'The bible of technical interview preparation with 189 programming questions and solutions', '#', '📘', '$35', 'Bestseller', 1),
  ('System Design Interview', 'Alex Xu', 'book', 'A hands-on guide to designing large-scale distributed systems', '#', '🏗️', '$30', 'Popular', 2)
) AS v(title, author, type, description, affiliate_url, icon, price, badge, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM admin_resources LIMIT 1);

-- Tip Jar config
INSERT INTO admin_tips (amounts, labels, descriptions, enabled)
SELECT '{5,15,30}', '{"☕ Coffee","🍕 Lunch","🎉 Celebration"}', '{"Buy me a coffee","Buy me lunch","Celebrating a new offer?"}', true
WHERE NOT EXISTS (SELECT 1 FROM admin_tips LIMIT 1);

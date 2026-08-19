/* Content Management System tables.
   Run this in the Supabase SQL editor to enable the admin Content CMS.
   
   Tables:
   - admin_testimonials: customer reviews on the landing page
   - admin_ads: sponsored banners and affiliate ads
   - admin_resources: recommended resources with affiliate links
   - admin_tips: tip jar configuration
   - admin_content_analytics: click/view tracking for ads and resources */

-- ============================================================
-- 1. Testimonials
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
  published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_testimonials ENABLE ROW LEVEL SECURITY;

-- Public read (anyone can see published testimonials)
CREATE POLICY "testimonials_public_read" ON admin_testimonials
  FOR SELECT USING (published = true);

-- Admin full access (server-enforced via is_admin RPC)
CREATE POLICY "testimonials_admin_all" ON admin_testimonials
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- 2. Advertisements
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sponsor TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT 'landing-pricing'
    CHECK (position IN ('landing-hero', 'landing-pricing', 'landing-footer', 'sidebar', 'interstitial')),
  start_date DATE,
  end_date DATE,
  published BOOLEAN NOT NULL DEFAULT true,
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
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
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
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- 4. Tip Jar config (singleton-ish — one row per config)
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
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- 5. Analytics (clicks + impressions tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_content_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('ad', 'resource', 'testimonial')),
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_content_analytics ENABLE ROW LEVEL SECURITY;

-- Public insert (anyone can record an impression/click)
CREATE POLICY "analytics_public_insert" ON admin_content_analytics
  FOR INSERT WITH CHECK (true);

-- Admin read only
CREATE POLICY "analytics_admin_read" ON admin_content_analytics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- 6. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_testimonials_sort ON admin_testimonials (sort_order);
CREATE INDEX IF NOT EXISTS idx_testimonials_published ON admin_testimonials (published);
CREATE INDEX IF NOT EXISTS idx_ads_published ON admin_ads (published);
CREATE INDEX IF NOT EXISTS idx_ads_position ON admin_ads (position);
CREATE INDEX IF NOT EXISTS idx_resources_sort ON admin_resources (sort_order);
CREATE INDEX IF NOT EXISTS idx_resources_published ON admin_resources (published);
CREATE INDEX IF NOT EXISTS idx_analytics_entity ON admin_content_analytics (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON admin_content_analytics (created_at);

-- ============================================================
-- 7. RPC for tracking clicks (increment counter atomically)
-- ============================================================
CREATE OR REPLACE FUNCTION track_content_click(p_entity_type TEXT, p_entity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_entity_type = 'ad' THEN
    UPDATE admin_ads SET clicks = clicks + 1, updated_at = now() WHERE id = p_entity_id;
  ELSIF p_entity_type = 'resource' THEN
    UPDATE admin_resources SET clicks = clicks + 1, updated_at = now() WHERE id = p_entity_id;
  END IF;

  INSERT INTO admin_content_analytics (entity_type, entity_id, event_type)
  VALUES (p_entity_type, p_entity_id, 'click');
END;
$$;

-- RPC for tracking impressions
CREATE OR REPLACE FUNCTION track_content_impression(p_entity_type TEXT, p_entity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_entity_type = 'ad' THEN
    UPDATE admin_ads SET impressions = impressions + 1, updated_at = now() WHERE id = p_entity_id;
  END IF;

  INSERT INTO admin_content_analytics (entity_type, entity_id, event_type)
  VALUES (p_entity_type, p_entity_id, 'impression');
END;
$$;

-- ============================================================
-- 8. RPC for admin to get analytics summary
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

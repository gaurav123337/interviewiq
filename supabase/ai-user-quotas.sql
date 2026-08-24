-- AI User Quotas — per-user daily/monthly limits + enable/disable toggle.
-- Admins can set custom quotas per user; defaults apply to everyone else.

CREATE TABLE IF NOT EXISTS ai_user_quotas (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_limit     INT NOT NULL DEFAULT 50,     -- AI calls per day (0 = unlimited)
  monthly_limit   INT NOT NULL DEFAULT 1000,   -- AI calls per month (0 = unlimited)
  daily_tokens    INT NOT NULL DEFAULT 50000,  -- max tokens per day (0 = unlimited)
  monthly_tokens  INT NOT NULL DEFAULT 500000, -- max tokens per month (0 = unlimited)
  enabled         BOOLEAN NOT NULL DEFAULT TRUE, -- admin can disable AI for a user
  note            TEXT,                          -- admin note (e.g. "abuse warning")
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: only admins can read/write quotas
ALTER TABLE ai_user_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read quotas" ON ai_user_quotas
  FOR SELECT USING (public.is_admin());

CREATE POLICY "admin write quotas" ON ai_user_quotas
  FOR ALL USING (public.is_admin());

-- Usage view — aggregated daily usage per user (for admin dashboard)
CREATE OR REPLACE VIEW ai_user_usage AS
SELECT
  user_id,
  DATE(created_at) AS day,
  COUNT(*) AS calls,
  SUM(input_tokens + output_tokens) AS tokens,
  SUM(estimated_cost) AS cost,
  COUNT(*) FILTER (WHERE cached) AS cached_calls,
  COUNT(*) FILTER (WHERE error) AS errors
FROM ai_cost_log
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE(created_at);

-- Users view for admin dashboards (email + id)
CREATE OR REPLACE VIEW users_view AS
SELECT id, email FROM auth.users;

-- Monthly usage view
CREATE OR REPLACE VIEW ai_user_usage_monthly AS
SELECT
  user_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS calls,
  SUM(input_tokens + output_tokens) AS tokens,
  SUM(estimated_cost) AS cost,
  COUNT(*) FILTER (WHERE cached) AS cached_calls,
  COUNT(*) FILTER (WHERE error) AS errors
FROM ai_cost_log
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE_TRUNC('month', created_at);

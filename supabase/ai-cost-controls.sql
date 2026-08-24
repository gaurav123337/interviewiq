-- AI Response Cache — stores LLM responses keyed by prompt hash to avoid
-- redundant API calls. Same question across users returns cached answer instantly.
-- Admin-configurable TTL per module.

CREATE TABLE IF NOT EXISTS ai_response_cache (
  cache_key   TEXT PRIMARY KEY,            -- SHA-256(system_prompt + "|" + user_prompt + "|" + model)
  module      TEXT NOT NULL,               -- 'feedback', 'hint', 'coach', 'deepdive', 'rag'
  response    TEXT NOT NULL,               -- cached LLM output
  model       TEXT NOT NULL,               -- which model produced this
  input_tokens  INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  hit_count   INT DEFAULT 0,               -- how many times served from cache
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_hit_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Index for TTL cleanup
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_response_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_module  ON ai_response_cache (module);

-- RLS: reads are open (cache is shared across users), writes are service-role only
ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cache read" ON ai_response_cache
  FOR SELECT USING (true);

-- Only service role (edge functions) can insert/update/delete
CREATE POLICY "cache write service" ON ai_response_cache
  FOR ALL USING (auth.role() = 'service_role');


-- AI Cost Log — tracks every API call with token counts and estimated cost.
-- Powers the admin cost monitoring dashboard.

CREATE TABLE IF NOT EXISTS ai_cost_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  module          TEXT NOT NULL,               -- 'feedback', 'hint', 'coach', etc.
  model           TEXT NOT NULL,               -- 'gpt-4o-mini', 'gpt-4o', etc.
  input_tokens    INT NOT NULL DEFAULT 0,
  output_tokens   INT NOT NULL DEFAULT 0,
  estimated_cost  NUMERIC(10,6) NOT NULL DEFAULT 0,  -- USD
  cached          BOOLEAN DEFAULT FALSE,       -- was this a cache hit?
  latency_ms      INT DEFAULT 0,
  error           BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_cost_log_user    ON ai_cost_log (user_id);
CREATE INDEX IF NOT EXISTS idx_cost_log_module  ON ai_cost_log (module);
CREATE INDEX IF NOT EXISTS idx_cost_log_date    ON ai_cost_log (created_at);
CREATE INDEX IF NOT EXISTS idx_cost_log_model   ON ai_cost_log (model);

-- RLS: only admins can read cost logs, service role writes
ALTER TABLE ai_cost_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read cost logs" ON ai_cost_log
  FOR SELECT USING (public.is_admin());

CREATE POLICY "cost log write service" ON ai_cost_log
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to insert their own cost logs
CREATE POLICY "user insert own cost logs" ON ai_cost_log
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);


-- AI Rate Limits — tracks per-user, per-minute request counts.
-- Enforced in the ai-chat edge function.

CREATE TABLE IF NOT EXISTS ai_rate_limits (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module      TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  call_count  INT DEFAULT 1,
  PRIMARY KEY (user_id, module, window_start)
);

-- Auto-cleanup: drop rows older than 5 minutes
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON ai_rate_limits (window_start);

ALTER TABLE ai_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate limit write service" ON ai_rate_limits
  FOR ALL USING (auth.role() = 'service_role');

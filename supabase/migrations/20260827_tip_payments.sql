-- Tip payments table — records verified tip donations via Razorpay
-- Created: 2026-08-27

CREATE TABLE IF NOT EXISTS public.tip_payments (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider      TEXT NOT NULL DEFAULT 'razorpay',
  provider_payment_id TEXT UNIQUE NOT NULL,
  provider_order_id   TEXT,
  amount_minor  BIGINT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'INR',
  tip_label     TEXT,          -- e.g. "☕ Coffee", "🍕 Lunch", "🎉 Celebration"
  status        TEXT NOT NULL DEFAULT 'captured',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for admin lookups
CREATE INDEX IF NOT EXISTS idx_tip_payments_user ON public.tip_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_tip_payments_created ON public.tip_payments(created_at DESC);

-- RLS: users can read their own tips, admins can read all
ALTER TABLE public.tip_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own tips"
    ON public.tip_payments FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tips"
    ON public.tip_payments FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin summary view
CREATE OR REPLACE VIEW public.admin_tip_summary AS
SELECT
  date_trunc('day', created_at) AS day,
  currency,
  COUNT(*)                       AS tip_count,
  SUM(amount_minor)              AS total_minor,
  COUNT(DISTINCT user_id)        AS unique_tippers
FROM public.tip_payments
GROUP BY 1, 2
ORDER BY 1 DESC;

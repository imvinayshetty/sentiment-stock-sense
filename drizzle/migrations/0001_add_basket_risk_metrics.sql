ALTER TABLE public.basket_prediction
  ADD COLUMN IF NOT EXISTS volatility_pct numeric,
  ADD COLUMN IF NOT EXISTS avg_range_pct numeric,
  ADD COLUMN IF NOT EXISTS risk_score integer,
  ADD COLUMN IF NOT EXISTS risk_label text;
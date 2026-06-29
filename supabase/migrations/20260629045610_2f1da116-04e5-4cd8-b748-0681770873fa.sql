-- Forecast quality fields for backtesting metrics (MAE, within-band %)
ALTER TABLE public.prediction_log
  ADD COLUMN IF NOT EXISTS lower_bound NUMERIC,
  ADD COLUMN IF NOT EXISTS upper_bound NUMERIC,
  ADD COLUMN IF NOT EXISTS sigma NUMERIC;

-- Cached Angel One JWT (single private row; backend only)
CREATE TABLE IF NOT EXISTS public.angel_session (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  jwt TEXT NOT NULL,
  feed_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.angel_session TO service_role;
ALTER TABLE public.angel_session ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: only service_role (which bypasses RLS) may touch it.

-- Demo trading portfolio persistence keyed to an anonymous session id
CREATE TABLE IF NOT EXISTS public.demo_state (
  session_id TEXT PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_state TO authenticated;
GRANT ALL ON public.demo_state TO service_role;
ALTER TABLE public.demo_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo state is publicly accessible"
  ON public.demo_state FOR ALL USING (true) WITH CHECK (true);
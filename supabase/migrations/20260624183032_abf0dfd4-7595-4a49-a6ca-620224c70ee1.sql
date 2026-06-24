-- Sentiment cache (written by edge function, publicly readable)
CREATE TABLE public.sentiment_cache (
  symbol TEXT PRIMARY KEY,
  score INTEGER NOT NULL,
  label TEXT NOT NULL,
  buzz INTEGER NOT NULL DEFAULT 0,
  articles JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sentiment_cache TO anon;
GRANT SELECT ON public.sentiment_cache TO authenticated;
GRANT ALL ON public.sentiment_cache TO service_role;
ALTER TABLE public.sentiment_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sentiment cache is publicly readable"
  ON public.sentiment_cache FOR SELECT USING (true);

-- Prediction log for backtesting (written by edge function, publicly readable)
CREATE TABLE public.prediction_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  predicted_at DATE NOT NULL,
  horizon_date DATE NOT NULL,
  base_price NUMERIC NOT NULL,
  predicted_price NUMERIC NOT NULL,
  direction TEXT NOT NULL,
  actual_price NUMERIC,
  correct BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (symbol, predicted_at, horizon_date)
);
GRANT SELECT ON public.prediction_log TO anon;
GRANT SELECT ON public.prediction_log TO authenticated;
GRANT ALL ON public.prediction_log TO service_role;
ALTER TABLE public.prediction_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prediction log is publicly readable"
  ON public.prediction_log FOR SELECT USING (true);

CREATE INDEX idx_prediction_log_symbol ON public.prediction_log (symbol, horizon_date);
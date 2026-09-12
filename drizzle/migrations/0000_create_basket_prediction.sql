CREATE TABLE IF NOT EXISTS public.basket_prediction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  basket_date DATE NOT NULL,
  symbol TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  predicted_close NUMERIC NOT NULL,
  direction TEXT NOT NULL,
  close_price NUMERIC,
  correct BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scored_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (session_id, basket_date, symbol)
);

GRANT SELECT ON public.basket_prediction TO anon;
GRANT SELECT ON public.basket_prediction TO authenticated;
GRANT ALL ON public.basket_prediction TO service_role;

ALTER TABLE public.basket_prediction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Basket predictions are publicly readable"
  ON public.basket_prediction FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_basket_prediction_day
  ON public.basket_prediction (session_id, basket_date);
ALTER TABLE public.sentiment_cache
  ADD COLUMN IF NOT EXISTS scored_by TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.demo_state ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_demo_state_created_at ON public.demo_state (created_at);
CREATE INDEX IF NOT EXISTS idx_demo_state_session_id ON public.demo_state (session_id);
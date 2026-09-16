CREATE TABLE public.app_totp (
  id text PRIMARY KEY DEFAULT 'owner',
  secret text NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_step bigint
);

GRANT ALL ON public.app_totp TO service_role;

ALTER TABLE public.app_totp ENABLE ROW LEVEL SECURITY;
-- No policies: only edge functions using the service role may read/write the TOTP secret.
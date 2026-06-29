CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Weekly cleanup: remove anonymous demo trading sessions older than 30 days
-- so the demo_state table does not grow unbounded.
SELECT cron.schedule(
  'cleanup-demo-state-weekly',
  '0 3 * * 0',
  $$ DELETE FROM public.demo_state WHERE created_at < now() - interval '30 days' $$
);
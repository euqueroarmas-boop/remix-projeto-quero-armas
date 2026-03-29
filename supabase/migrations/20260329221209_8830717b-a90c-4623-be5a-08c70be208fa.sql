
-- Add missing columns to test_runs
ALTER TABLE public.test_runs
  ADD COLUMN IF NOT EXISTS progress_percent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_spec text,
  ADD COLUMN IF NOT EXISTS current_test text,
  ADD COLUMN IF NOT EXISTS current_url text,
  ADD COLUMN IF NOT EXISTS total_specs integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_specs integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_tests integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_summary text,
  ADD COLUMN IF NOT EXISTS ingest_token text;

-- Create test_run_events table for granular event tracking
CREATE TABLE IF NOT EXISTS public.test_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  spec_name text,
  test_name text,
  url text,
  status text,
  duration_ms integer,
  error_message text,
  stack_trace text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on test_run_events
ALTER TABLE public.test_run_events ENABLE ROW LEVEL SECURITY;

-- Public full access (controlled by ingest_token in code)
CREATE POLICY "Public access test_run_events" ON public.test_run_events
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Enable realtime for test_run_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_run_events;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_test_run_events_run_id ON public.test_run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_test_run_events_created_at ON public.test_run_events(created_at DESC);

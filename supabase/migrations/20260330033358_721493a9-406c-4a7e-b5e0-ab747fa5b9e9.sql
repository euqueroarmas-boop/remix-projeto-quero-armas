
CREATE TABLE public.prompt_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'pending',
  analysis_data jsonb DEFAULT '{}'::jsonb,
  prompts jsonb DEFAULT '[]'::jsonb,
  summary text,
  total_prompts integer DEFAULT 0,
  high_priority integer DEFAULT 0,
  medium_priority integer DEFAULT 0,
  low_priority integer DEFAULT 0,
  triggered_by text DEFAULT 'admin',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone
);

ALTER TABLE public.prompt_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access prompt_intelligence"
  ON public.prompt_intelligence FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read prompt_intelligence"
  ON public.prompt_intelligence FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public insert prompt_intelligence"
  ON public.prompt_intelligence FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public update prompt_intelligence"
  ON public.prompt_intelligence FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

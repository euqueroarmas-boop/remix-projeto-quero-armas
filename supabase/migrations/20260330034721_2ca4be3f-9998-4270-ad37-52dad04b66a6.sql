
ALTER TABLE public.prompt_intelligence
  ADD COLUMN IF NOT EXISTS prompt_type text DEFAULT 'correction',
  ADD COLUMN IF NOT EXISTS confidence float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS auto_applicable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS applied boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS impact_score float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'log',
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

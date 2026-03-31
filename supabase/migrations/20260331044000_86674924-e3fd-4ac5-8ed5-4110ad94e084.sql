
CREATE TABLE public.cipa_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_days integer,
  duration_seconds bigint,
  duration_label text,
  note text,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cipa_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access cipa_cycles"
  ON public.cipa_cycles FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Insert the first current cycle
INSERT INTO public.cipa_cycles (started_at, is_current) VALUES (now(), true);

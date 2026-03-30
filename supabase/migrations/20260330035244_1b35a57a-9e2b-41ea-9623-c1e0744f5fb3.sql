
CREATE TABLE public.revenue_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  service_type text,
  lead_value_estimate numeric DEFAULT 0,
  conversion_probability float DEFAULT 0,
  urgency_level text DEFAULT 'media',
  decision_stage text DEFAULT 'awareness',
  price_suggested numeric,
  discount_suggested float DEFAULT 0,
  strategy text,
  company_size text,
  machines_qty integer,
  pain_point text,
  sector text,
  actual_value numeric,
  converted boolean DEFAULT false,
  analysis_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access revenue_intelligence"
  ON public.revenue_intelligence FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Public read revenue_intelligence"
  ON public.revenue_intelligence FOR SELECT TO public
  USING (true);

CREATE POLICY "Public insert revenue_intelligence"
  ON public.revenue_intelligence FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Public update revenue_intelligence"
  ON public.revenue_intelligence FOR UPDATE TO public
  USING (true) WITH CHECK (true);

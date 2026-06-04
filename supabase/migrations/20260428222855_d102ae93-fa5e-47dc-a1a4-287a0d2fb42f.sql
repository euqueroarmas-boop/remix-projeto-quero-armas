CREATE TABLE IF NOT EXISTS public.qa_dashboard_kpi_layout (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cliente_id INTEGER NULL,
  dashboard_type TEXT NOT NULL DEFAULT 'arsenal',
  kpi_order JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_qa_dashboard_kpi_layout UNIQUE (user_id, dashboard_type, cliente_id)
);

ALTER TABLE public.qa_dashboard_kpi_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own kpi layout select"
  ON public.qa_dashboard_kpi_layout FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user manages own kpi layout insert"
  ON public.qa_dashboard_kpi_layout FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user manages own kpi layout update"
  ON public.qa_dashboard_kpi_layout FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user manages own kpi layout delete"
  ON public.qa_dashboard_kpi_layout FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.qa_dashboard_kpi_layout_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qa_dashboard_kpi_layout_updated
BEFORE UPDATE ON public.qa_dashboard_kpi_layout
FOR EACH ROW EXECUTE FUNCTION public.qa_dashboard_kpi_layout_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_qa_dashboard_kpi_layout_user
  ON public.qa_dashboard_kpi_layout(user_id, dashboard_type);
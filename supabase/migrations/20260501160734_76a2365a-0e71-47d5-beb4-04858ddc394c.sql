CREATE TABLE IF NOT EXISTS public.qa_cliente_kpi_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  contexto text NOT NULL DEFAULT 'arsenal',
  ordem_kpis jsonb NOT NULL DEFAULT '[]'::jsonb,
  kpis_ocultas jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_cliente_kpi_layouts
  ON public.qa_cliente_kpi_layouts (cliente_id, contexto);

CREATE OR REPLACE FUNCTION public.qa_cliente_kpi_layouts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_cliente_kpi_layouts_updated ON public.qa_cliente_kpi_layouts;
CREATE TRIGGER trg_qa_cliente_kpi_layouts_updated
  BEFORE UPDATE ON public.qa_cliente_kpi_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_cliente_kpi_layouts_set_updated_at();

ALTER TABLE public.qa_cliente_kpi_layouts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.qa_is_owner_of_cliente(_cliente_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.qa_clientes c
     WHERE c.id = _cliente_id AND c.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "kpi layout select" ON public.qa_cliente_kpi_layouts;
CREATE POLICY "kpi layout select"
  ON public.qa_cliente_kpi_layouts FOR SELECT TO authenticated
  USING (public.qa_is_owner_of_cliente(cliente_id) OR public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "kpi layout insert" ON public.qa_cliente_kpi_layouts;
CREATE POLICY "kpi layout insert"
  ON public.qa_cliente_kpi_layouts FOR INSERT TO authenticated
  WITH CHECK (public.qa_is_owner_of_cliente(cliente_id) OR public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "kpi layout update" ON public.qa_cliente_kpi_layouts;
CREATE POLICY "kpi layout update"
  ON public.qa_cliente_kpi_layouts FOR UPDATE TO authenticated
  USING (public.qa_is_owner_of_cliente(cliente_id) OR public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_owner_of_cliente(cliente_id) OR public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "kpi layout delete" ON public.qa_cliente_kpi_layouts;
CREATE POLICY "kpi layout delete"
  ON public.qa_cliente_kpi_layouts FOR DELETE TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

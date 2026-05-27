CREATE TABLE IF NOT EXISTS public.qa_template_placeholder_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placeholder text NOT NULL UNIQUE,
  label_cliente text,
  pergunta_cliente text,
  texto_ajuda text,
  exemplo_placeholder text,
  grupo_visual text,
  ordem integer,
  obrigatorio_override boolean,
  ativo boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qa_template_placeholder_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_template_placeholder_config TO authenticated;
GRANT ALL ON public.qa_template_placeholder_config TO service_role;

ALTER TABLE public.qa_template_placeholder_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_tpcfg_select_all"
  ON public.qa_template_placeholder_config
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "qa_tpcfg_insert_staff"
  ON public.qa_template_placeholder_config
  FOR INSERT
  TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_tpcfg_update_staff"
  ON public.qa_template_placeholder_config
  FOR UPDATE
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_tpcfg_delete_staff"
  ON public.qa_template_placeholder_config
  FOR DELETE
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_qa_tpcfg_placeholder_ativo
  ON public.qa_template_placeholder_config (placeholder)
  WHERE ativo = true;

CREATE OR REPLACE FUNCTION public.qa_tpcfg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_tpcfg_updated_at ON public.qa_template_placeholder_config;
CREATE TRIGGER trg_qa_tpcfg_updated_at
BEFORE UPDATE ON public.qa_template_placeholder_config
FOR EACH ROW
EXECUTE FUNCTION public.qa_tpcfg_set_updated_at();
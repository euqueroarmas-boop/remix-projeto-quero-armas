CREATE TABLE IF NOT EXISTS public.qa_habitualidade_alertas_ativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  titulo text NOT NULL,
  motivo text,
  proxima_acao text,
  nivel_atual text,
  nivel_sugerido text,
  treinos_validos integer,
  competicoes_validas integer,
  tipo_arma_ancora text,
  periodo_ref text,
  marco_hash text NOT NULL,
  prioridade integer NOT NULL DEFAULT 80,
  ativo boolean NOT NULL DEFAULT true,
  dados_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, template_name, marco_hash)
);

CREATE INDEX IF NOT EXISTS idx_qa_hab_alertas_ativos_cliente
  ON public.qa_habitualidade_alertas_ativos (cliente_id, ativo, prioridade);

GRANT SELECT ON public.qa_habitualidade_alertas_ativos TO authenticated;
GRANT ALL ON public.qa_habitualidade_alertas_ativos TO service_role;

ALTER TABLE public.qa_habitualidade_alertas_ativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_hab_alertas_ativos_owner_select ON public.qa_habitualidade_alertas_ativos;
CREATE POLICY qa_hab_alertas_ativos_owner_select
  ON public.qa_habitualidade_alertas_ativos
  FOR SELECT
  TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

DROP POLICY IF EXISTS qa_hab_alertas_ativos_staff_all ON public.qa_habitualidade_alertas_ativos;
CREATE POLICY qa_hab_alertas_ativos_staff_all
  ON public.qa_habitualidade_alertas_ativos
  FOR ALL
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_hab_alertas_ativos_service_role ON public.qa_habitualidade_alertas_ativos;
CREATE POLICY qa_hab_alertas_ativos_service_role
  ON public.qa_habitualidade_alertas_ativos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.qa_hab_alertas_ativos_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_hab_alertas_ativos_touch ON public.qa_habitualidade_alertas_ativos;
CREATE TRIGGER trg_qa_hab_alertas_ativos_touch
  BEFORE UPDATE ON public.qa_habitualidade_alertas_ativos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_hab_alertas_ativos_touch_updated_at();

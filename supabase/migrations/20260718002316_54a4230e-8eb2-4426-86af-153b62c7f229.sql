CREATE TABLE IF NOT EXISTS public.qa_piloto_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piloto_session_id uuid NOT NULL,
  venda_id integer NULL,
  venda_id_legado integer NULL,
  tipo_evento text NOT NULL,
  dados_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  staff_user_id uuid NULL,
  staff_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.qa_piloto_eventos TO authenticated;
GRANT ALL ON public.qa_piloto_eventos TO service_role;

CREATE INDEX IF NOT EXISTS idx_qa_piloto_eventos_session
  ON public.qa_piloto_eventos (piloto_session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qa_piloto_eventos_venda
  ON public.qa_piloto_eventos (venda_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qa_piloto_eventos_venda_legado
  ON public.qa_piloto_eventos (venda_id_legado, created_at);
CREATE INDEX IF NOT EXISTS idx_qa_piloto_eventos_tipo
  ON public.qa_piloto_eventos (tipo_evento);

ALTER TABLE public.qa_piloto_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_piloto_eventos_staff_insert"
  ON public.qa_piloto_eventos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "qa_piloto_eventos_staff_select"
  ON public.qa_piloto_eventos
  FOR SELECT
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

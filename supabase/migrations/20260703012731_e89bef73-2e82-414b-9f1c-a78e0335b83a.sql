CREATE TABLE public.qa_central_ajuda_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL,
  pergunta text NOT NULL,
  resposta_ia text,
  artigos_relacionados jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'escalada_whatsapp'
    CHECK (status IN ('escalada_whatsapp', 'resolvida')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.qa_central_ajuda_perguntas TO authenticated;
GRANT ALL ON public.qa_central_ajuda_perguntas TO service_role;

ALTER TABLE public.qa_central_ajuda_perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY qa_central_ajuda_perguntas_staff_select
  ON public.qa_central_ajuda_perguntas FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE POLICY qa_central_ajuda_perguntas_owner_select
  ON public.qa_central_ajuda_perguntas FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

CREATE POLICY qa_central_ajuda_perguntas_owner_insert
  ON public.qa_central_ajuda_perguntas FOR INSERT TO authenticated
  WITH CHECK (cliente_id = public.qa_current_cliente_id(auth.uid()));

CREATE POLICY qa_central_ajuda_perguntas_staff_update
  ON public.qa_central_ajuda_perguntas FOR UPDATE TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE TABLE IF NOT EXISTS public.qa_status_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_status_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_status_servico_select_all" ON public.qa_status_servico FOR SELECT USING (true);
CREATE POLICY "qa_status_servico_insert_auth" ON public.qa_status_servico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "qa_status_servico_update_auth" ON public.qa_status_servico FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qa_status_servico_delete_auth" ON public.qa_status_servico FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_qa_status_servico_updated
BEFORE UPDATE ON public.qa_status_servico
FOR EACH ROW EXECUTE FUNCTION public.update_fiscal_documents_updated_at();

INSERT INTO public.qa_status_servico (nome, ordem) VALUES
  ('EM ANÁLISE', 10),
  ('PRONTO PARA ANÁLISE', 20),
  ('À INICIAR', 30),
  ('À FAZER', 40),
  ('AGUARDANDO DOCUMENTAÇÃO', 50),
  ('PASTA FÍSICA - AGUARDANDO LIBERAÇÃO', 60),
  ('DEFERIDO', 70),
  ('INDEFERIDO', 80),
  ('RECURSO ADMINISTRATIVO', 90),
  ('CONCLUÍDO', 100),
  ('DESISTIU', 110),
  ('RESTITUÍDO', 120)
ON CONFLICT (nome) DO NOTHING;
CREATE TABLE public.qa_checklist_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#7A1F2B',
  ordem integer NOT NULL DEFAULT 100,
  servico_id integer NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX qa_checklist_grupos_slug_escopo ON public.qa_checklist_grupos (slug, COALESCE(servico_id, 0));
CREATE INDEX qa_checklist_grupos_servico_idx ON public.qa_checklist_grupos (servico_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_checklist_grupos TO authenticated;
GRANT ALL ON public.qa_checklist_grupos TO service_role;
ALTER TABLE public.qa_checklist_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_checklist_grupos_staff_all ON public.qa_checklist_grupos
  FOR ALL TO authenticated USING (qa_is_active_staff(auth.uid())) WITH CHECK (qa_is_active_staff(auth.uid()));
CREATE POLICY qa_checklist_grupos_read_auth ON public.qa_checklist_grupos
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.qa_checklist_rascunhos (
  servico_id integer PRIMARY KEY,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  atualizado_por uuid NULL,
  publicado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_checklist_rascunhos TO authenticated;
GRANT ALL ON public.qa_checklist_rascunhos TO service_role;
ALTER TABLE public.qa_checklist_rascunhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_checklist_rascunhos_staff_all ON public.qa_checklist_rascunhos
  FOR ALL TO authenticated USING (qa_is_active_staff(auth.uid())) WITH CHECK (qa_is_active_staff(auth.uid()));

ALTER TABLE public.qa_servicos_documentos
  ADD COLUMN IF NOT EXISTS grupo_id uuid NULL REFERENCES public.qa_checklist_grupos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS qa_servicos_documentos_grupo_idx ON public.qa_servicos_documentos (grupo_id);

CREATE TRIGGER qa_checklist_grupos_touch BEFORE UPDATE ON public.qa_checklist_grupos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER qa_checklist_rascunhos_touch BEFORE UPDATE ON public.qa_checklist_rascunhos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.qa_checklist_grupos (slug, nome, ordem, cor) VALUES
  ('identificacao','Identificação',30,'#7A1F2B'),
  ('endereco','Comprovação de endereço',40,'#7A1F2B'),
  ('antecedentes','Antecedentes criminais',50,'#7A1F2B'),
  ('ocupacao','Ocupação lícita e renda',60,'#7A1F2B'),
  ('habitualidade','Habitualidade e clube',70,'#7A1F2B'),
  ('arma','Documentos da arma',72,'#7A1F2B'),
  ('declaracoes','Declarações do processo',75,'#7A1F2B'),
  ('efetiva_necessidade','Efetiva necessidade',80,'#7A1F2B'),
  ('saude','Aptidão psicológica e técnica',90,'#7A1F2B'),
  ('requerimento','Requerimento',95,'#7A1F2B'),
  ('outros','Outros documentos',99,'#5A5A5A');
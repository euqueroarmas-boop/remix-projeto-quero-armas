
CREATE TABLE public.qa_casos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL DEFAULT '',
  nome_requerente TEXT NOT NULL DEFAULT '',
  cpf_cnpj TEXT,
  tipo_peca TEXT,
  tipo_servico TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  endereco TEXT,
  bairro TEXT,
  unidade_pf TEXT,
  sigla_unidade_pf TEXT,
  descricao_caso TEXT,
  foco_argumentativo TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  minuta_gerada TEXT,
  geracao_id UUID,
  docx_path TEXT,
  documentos_auxiliares_json JSONB DEFAULT '[]'::jsonb,
  erros_documentos_json JSONB DEFAULT '[]'::jsonb,
  usuario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_casos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view qa_casos"
  ON public.qa_casos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert qa_casos"
  ON public.qa_casos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update qa_casos"
  ON public.qa_casos FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_qa_casos_nome ON public.qa_casos (nome_requerente);
CREATE INDEX idx_qa_casos_tipo_servico ON public.qa_casos (tipo_servico);
CREATE INDEX idx_qa_casos_status ON public.qa_casos (status);
CREATE INDEX idx_qa_casos_usuario ON public.qa_casos (usuario_id);
CREATE INDEX idx_qa_casos_created ON public.qa_casos (created_at DESC);

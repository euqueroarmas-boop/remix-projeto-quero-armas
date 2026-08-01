CREATE TABLE public.qa_nf_golden_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID,
  documento_id UUID,
  processo_documento_id UUID,

  -- Cabeçalho / identificação da NFS-e
  chave_acesso TEXT NOT NULL,
  numero_nfse TEXT,
  competencia DATE,
  data_emissao_nfse TIMESTAMPTZ,
  numero_dps TEXT,
  serie_dps TEXT,
  municipio_emissor TEXT,
  email_municipio TEXT,

  -- Prestador
  prestador_cnpj TEXT,
  prestador_nome TEXT,
  prestador_inscricao_municipal TEXT,
  prestador_telefone TEXT,
  prestador_email TEXT,
  prestador_endereco TEXT,
  prestador_municipio TEXT,
  prestador_cep TEXT,
  prestador_simples_nacional TEXT,
  prestador_regime_apuracao TEXT,

  -- Tomador
  tomador_documento TEXT,
  tomador_nome TEXT,
  tomador_inscricao_municipal TEXT,
  tomador_telefone TEXT,
  tomador_email TEXT,
  tomador_endereco TEXT,
  tomador_municipio TEXT,
  tomador_cep TEXT,

  -- Serviço prestado
  codigo_tributacao_nacional TEXT,
  codigo_tributacao_municipal TEXT,
  local_prestacao TEXT,
  pais_prestacao TEXT,
  descricao_servico TEXT,
  itens_servico JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Valores / tributação
  tributacao_issqn TEXT,
  municipio_incidencia_issqn TEXT,
  retencao_issqn TEXT,
  valor_servico NUMERIC(14,2),
  valor_liquido NUMERIC(14,2),

  texto_bruto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qa_nf_golden_records_chave_unica UNIQUE (chave_acesso)
);

GRANT SELECT, INSERT, UPDATE ON public.qa_nf_golden_records TO authenticated;
GRANT ALL ON public.qa_nf_golden_records TO service_role;

ALTER TABLE public.qa_nf_golden_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem golden records de NF"
  ON public.qa_nf_golden_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados criam golden records de NF"
  ON public.qa_nf_golden_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados atualizam golden records de NF"
  ON public.qa_nf_golden_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX qa_nf_golden_records_cliente_idx ON public.qa_nf_golden_records (cliente_id);
CREATE INDEX qa_nf_golden_records_prestador_cnpj_idx ON public.qa_nf_golden_records (prestador_cnpj);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_qa_nf_golden_records_updated_at
  BEFORE UPDATE ON public.qa_nf_golden_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
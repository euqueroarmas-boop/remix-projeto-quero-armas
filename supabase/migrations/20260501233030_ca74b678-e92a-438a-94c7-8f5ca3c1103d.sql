-- Garantir extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- TABELA: qa_documentos_modelos_aprovados
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qa_documentos_modelos_aprovados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento TEXT NOT NULL,
  nome_modelo TEXT,
  origem_emissora TEXT,
  documento_origem_id UUID REFERENCES public.qa_processo_documentos(id) ON DELETE SET NULL,
  texto_ocr_normalizado TEXT,
  palavras_chave_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  campos_esperados_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout_fingerprint_json JSONB,
  embedding_texto vector(768),
  versao_modelo INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  aprovado_por UUID,
  aprovado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_modelos_tipo_ativo
  ON public.qa_documentos_modelos_aprovados (tipo_documento, ativo);

CREATE INDEX IF NOT EXISTS idx_qa_modelos_embedding_cos
  ON public.qa_documentos_modelos_aprovados
  USING ivfflat (embedding_texto vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_qa_modelos_origem_doc
  ON public.qa_documentos_modelos_aprovados (documento_origem_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.qa_modelos_aprovados_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_qa_modelos_touch ON public.qa_documentos_modelos_aprovados;
CREATE TRIGGER trg_qa_modelos_touch
  BEFORE UPDATE ON public.qa_documentos_modelos_aprovados
  FOR EACH ROW EXECUTE FUNCTION public.qa_modelos_aprovados_touch_updated_at();

-- RLS: somente Equipe Quero Armas
ALTER TABLE public.qa_documentos_modelos_aprovados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_modelos_staff_all" ON public.qa_documentos_modelos_aprovados;
CREATE POLICY "qa_modelos_staff_all"
  ON public.qa_documentos_modelos_aprovados
  FOR ALL
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- ============================================================
-- Novos campos em qa_processo_documentos (aditivos)
-- ============================================================
ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS texto_ocr_extraido TEXT,
  ADD COLUMN IF NOT EXISTS score_modelo_aprovado NUMERIC,
  ADD COLUMN IF NOT EXISTS modelo_aprovado_id UUID REFERENCES public.qa_documentos_modelos_aprovados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usado_como_modelo BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- TABELA: qa_validacao_config (limites por tipo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qa_validacao_config (
  tipo_documento TEXT PRIMARY KEY,
  limite_aprovacao_auto NUMERIC NOT NULL DEFAULT 0.85,
  limite_analise_humana NUMERIC NOT NULL DEFAULT 0.50,
  permite_aprovacao_auto BOOLEAN NOT NULL DEFAULT true,
  alimenta_aprendizado BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_validacao_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_validacao_config_staff_all" ON public.qa_validacao_config;
CREATE POLICY "qa_validacao_config_staff_all"
  ON public.qa_validacao_config
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- Defaults: documentos críticos preferem revisão humana
INSERT INTO public.qa_validacao_config (tipo_documento, limite_aprovacao_auto, limite_analise_humana, permite_aprovacao_auto, observacoes) VALUES
  ('renda_cartao_cnpj',     0.85, 0.50, true,  'CNPJ ATIVO + cliente no QSA'),
  ('renda_qsa',             0.85, 0.50, true,  'CNPJ + sócios identificados'),
  ('renda_contrato_social', 0.88, 0.55, true,  NULL),
  ('renda_nf_empresa',      0.85, 0.50, true,  NULL),
  ('comprovante_residencia',0.88, 0.55, true,  NULL),
  ('rg',                    0.90, 0.60, true,  NULL),
  ('cin',                   0.90, 0.60, true,  NULL),
  ('cnh',                   0.90, 0.60, true,  NULL),
  ('antecedentes_criminais',0.95, 0.70, false, 'Crítico: sempre revisão humana'),
  ('cr',                    0.95, 0.70, false, 'Crítico: sempre revisão humana'),
  ('craf',                  0.95, 0.70, false, 'Crítico: sempre revisão humana'),
  ('gte',                   0.95, 0.70, false, 'Crítico: sempre revisão humana'),
  ('laudo_psicologico',     0.95, 0.70, false, 'Crítico: sempre revisão humana'),
  ('laudo_tiro',            0.95, 0.70, false, 'Crítico: sempre revisão humana'),
  ('nota_fiscal_arma',      0.92, 0.65, false, 'Crítico: documento de arma'),
  ('autorizacao_compra',    0.92, 0.65, false, 'Crítico: AC do Exército')
ON CONFLICT (tipo_documento) DO NOTHING;

-- ============================================================
-- FUNÇÃO: match_qa_modelos_aprovados
-- Retorna top N modelos aprovados mais similares ao embedding dado.
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_qa_modelos_aprovados(
  query_embedding vector(768),
  filtro_tipo TEXT,
  match_limit INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  tipo_documento TEXT,
  nome_modelo TEXT,
  origem_emissora TEXT,
  similaridade NUMERIC,
  palavras_chave_json JSONB,
  campos_esperados_json JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.tipo_documento,
    m.nome_modelo,
    m.origem_emissora,
    (1 - (m.embedding_texto <=> query_embedding))::numeric AS similaridade,
    m.palavras_chave_json,
    m.campos_esperados_json
  FROM public.qa_documentos_modelos_aprovados m
  WHERE m.ativo = true
    AND m.embedding_texto IS NOT NULL
    AND (filtro_tipo IS NULL OR m.tipo_documento = filtro_tipo)
  ORDER BY m.embedding_texto <=> query_embedding ASC
  LIMIT GREATEST(match_limit, 1);
$$;
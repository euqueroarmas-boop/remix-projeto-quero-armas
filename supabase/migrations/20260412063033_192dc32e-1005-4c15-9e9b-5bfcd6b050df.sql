
-- 1. qa_referencias_preferenciais
CREATE TABLE public.qa_referencias_preferenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_referencia TEXT NOT NULL, -- geracao_aprovada, jurisprudencia_validada, norma_oficial, documento_referencia
  origem_id UUID NOT NULL,
  motivo_priorizacao TEXT,
  peso_manual NUMERIC DEFAULT 1.0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.qa_referencias_preferenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_refs_pref_select" ON public.qa_referencias_preferenciais FOR SELECT TO authenticated USING (true);
CREATE POLICY "qa_refs_pref_insert" ON public.qa_referencias_preferenciais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "qa_refs_pref_update" ON public.qa_referencias_preferenciais FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_qa_refs_tipo ON public.qa_referencias_preferenciais(tipo_referencia);
CREATE INDEX idx_qa_refs_origem ON public.qa_referencias_preferenciais(origem_id);

-- 2. qa_metricas_recuperacao
CREATE TABLE public.qa_metricas_recuperacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id UUID REFERENCES public.qa_consultas_ia(id) ON DELETE CASCADE,
  fonte_tipo TEXT NOT NULL,
  fonte_id UUID,
  score_semantico NUMERIC DEFAULT 0,
  score_textual NUMERIC DEFAULT 0,
  score_feedback NUMERIC DEFAULT 0,
  score_validacao NUMERIC DEFAULT 0,
  score_final NUMERIC DEFAULT 0,
  foi_utilizada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.qa_metricas_recuperacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_metricas_select" ON public.qa_metricas_recuperacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "qa_metricas_insert" ON public.qa_metricas_recuperacao FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_qa_metricas_consulta ON public.qa_metricas_recuperacao(consulta_id);
CREATE INDEX idx_qa_metricas_fonte ON public.qa_metricas_recuperacao(fonte_tipo, fonte_id);

-- 3. qa_revisoes_pecas
CREATE TABLE public.qa_revisoes_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geracao_id UUID REFERENCES public.qa_geracoes_pecas(id) ON DELETE CASCADE,
  usuario_id UUID,
  texto_original TEXT,
  texto_revisado TEXT,
  tipo_revisao TEXT DEFAULT 'correcao', -- correcao, aprovacao, rejeicao, referencia
  justificativa TEXT,
  aprovada BOOLEAN DEFAULT false,
  virou_referencia BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.qa_revisoes_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_revisoes_select" ON public.qa_revisoes_pecas FOR SELECT TO authenticated USING (true);
CREATE POLICY "qa_revisoes_insert" ON public.qa_revisoes_pecas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "qa_revisoes_update" ON public.qa_revisoes_pecas FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_qa_revisoes_geracao ON public.qa_revisoes_pecas(geracao_id);

-- 4. Add columns to qa_geracoes_pecas for depth/tone/focus and review status
ALTER TABLE public.qa_geracoes_pecas ADD COLUMN IF NOT EXISTS profundidade TEXT DEFAULT 'intermediaria';
ALTER TABLE public.qa_geracoes_pecas ADD COLUMN IF NOT EXISTS tom TEXT DEFAULT 'tecnico_padrao';
ALTER TABLE public.qa_geracoes_pecas ADD COLUMN IF NOT EXISTS foco TEXT DEFAULT 'legalidade';
ALTER TABLE public.qa_geracoes_pecas ADD COLUMN IF NOT EXISTS status_revisao TEXT DEFAULT 'rascunho';
ALTER TABLE public.qa_geracoes_pecas ADD COLUMN IF NOT EXISTS score_confianca NUMERIC DEFAULT 0;

-- 5. Add column to qa_consultas_ia for confidence score
ALTER TABLE public.qa_consultas_ia ADD COLUMN IF NOT EXISTS score_confianca NUMERIC DEFAULT 0;
ALTER TABLE public.qa_consultas_ia ADD COLUMN IF NOT EXISTS profundidade TEXT;
ALTER TABLE public.qa_consultas_ia ADD COLUMN IF NOT EXISTS tom TEXT;
ALTER TABLE public.qa_consultas_ia ADD COLUMN IF NOT EXISTS foco TEXT;

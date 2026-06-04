-- ============================================================
-- FASE 1: Sistema de Correções Supervisionadas da IA Jurídica
-- ============================================================

-- Enum: categoria do erro
DO $$ BEGIN
  CREATE TYPE public.qa_categoria_erro_ia AS ENUM (
    'enderecamento_errado',
    'circunscricao_errada',
    'fundamento_juridico_incorreto',
    'tese_inadequada',
    'excesso_linguagem',
    'omissao_fato_relevante',
    'uso_dado_inexistente',
    'confusao_posse_porte',
    'confusao_sinarm_sigma',
    'confusao_pf_exercito',
    'prazo_administrativo_errado',
    'redacao_fraca',
    'pedido_final_incorreto',
    'conclusao_desalinhada',
    'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.qa_ia_correcoes_juridicas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_peca TEXT NOT NULL,
  foco_argumentativo TEXT,
  categoria_erro public.qa_categoria_erro_ia NOT NULL DEFAULT 'outro',
  trecho_errado TEXT NOT NULL,
  trecho_correto TEXT NOT NULL,
  explicacao TEXT,
  regra_aplicavel TEXT,
  aplicar_globalmente BOOLEAN NOT NULL DEFAULT true,
  cliente_id UUID,
  caso_id UUID,
  peca_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID,
  criado_por_nome TEXT,
  usado_vezes INTEGER NOT NULL DEFAULT 0,
  ultima_utilizacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qa_ia_correcoes_trecho_errado_min CHECK (length(trim(trecho_errado)) >= 5),
  CONSTRAINT qa_ia_correcoes_trecho_correto_min CHECK (length(trim(trecho_correto)) >= 5),
  CONSTRAINT qa_ia_correcoes_escopo_coerente CHECK (
    aplicar_globalmente = true
    OR cliente_id IS NOT NULL
    OR caso_id IS NOT NULL
    OR peca_id IS NOT NULL
  )
);

-- Índices para a busca na geração de peças
CREATE INDEX IF NOT EXISTS idx_qa_correcoes_global_ativo
  ON public.qa_ia_correcoes_juridicas (tipo_peca, ativo)
  WHERE aplicar_globalmente = true AND ativo = true;

CREATE INDEX IF NOT EXISTS idx_qa_correcoes_cliente
  ON public.qa_ia_correcoes_juridicas (cliente_id, ativo)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_correcoes_caso
  ON public.qa_ia_correcoes_juridicas (caso_id, ativo)
  WHERE caso_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_correcoes_peca
  ON public.qa_ia_correcoes_juridicas (peca_id, ativo)
  WHERE peca_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_correcoes_categoria
  ON public.qa_ia_correcoes_juridicas (categoria_erro);

-- Trigger updated_at (reusa função existente do projeto)
DROP TRIGGER IF EXISTS trg_qa_ia_correcoes_updated_at ON public.qa_ia_correcoes_juridicas;
CREATE TRIGGER trg_qa_ia_correcoes_updated_at
BEFORE UPDATE ON public.qa_ia_correcoes_juridicas
FOR EACH ROW EXECUTE FUNCTION public.qa_set_updated_at();

-- RLS
ALTER TABLE public.qa_ia_correcoes_juridicas ENABLE ROW LEVEL SECURITY;

-- Policies: somente equipe interna (qa_is_active_staff)
DROP POLICY IF EXISTS "Equipe pode ver correcoes IA" ON public.qa_ia_correcoes_juridicas;
CREATE POLICY "Equipe pode ver correcoes IA"
ON public.qa_ia_correcoes_juridicas
FOR SELECT
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Equipe pode criar correcoes IA" ON public.qa_ia_correcoes_juridicas;
CREATE POLICY "Equipe pode criar correcoes IA"
ON public.qa_ia_correcoes_juridicas
FOR INSERT
TO authenticated
WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Equipe pode atualizar correcoes IA" ON public.qa_ia_correcoes_juridicas;
CREATE POLICY "Equipe pode atualizar correcoes IA"
ON public.qa_ia_correcoes_juridicas
FOR UPDATE
TO authenticated
USING (public.qa_is_active_staff(auth.uid()))
WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "Equipe pode deletar correcoes IA" ON public.qa_ia_correcoes_juridicas;
CREATE POLICY "Equipe pode deletar correcoes IA"
ON public.qa_ia_correcoes_juridicas
FOR DELETE
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

COMMENT ON TABLE public.qa_ia_correcoes_juridicas IS
  'Camada de aprendizado supervisionado da IA jurídica QA. Correções ativas serão injetadas no prompt de qa-gerar-peca (Fase 3).';
COMMENT ON COLUMN public.qa_ia_correcoes_juridicas.aplicar_globalmente IS
  'true = vale para todas as peças do mesmo tipo; false = restrito a cliente_id/caso_id/peca_id.';
-- 1) Enums
DO $$ BEGIN
  CREATE TYPE qa_ia_tipo_registro AS ENUM ('correcao_erro', 'treinamento_direto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qa_ia_prioridade AS ENUM ('baixa', 'media', 'alta', 'critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Novas colunas
ALTER TABLE public.qa_ia_correcoes_juridicas
  ADD COLUMN IF NOT EXISTS tipo_registro qa_ia_tipo_registro NOT NULL DEFAULT 'correcao_erro',
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS instrucao text,
  ADD COLUMN IF NOT EXISTS servico_procedimento text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS exemplo_aplicacao text,
  ADD COLUMN IF NOT EXISTS prioridade qa_ia_prioridade NOT NULL DEFAULT 'media';

-- 3) Trecho errado/correto agora podem ser nulos para treinamentos diretos
ALTER TABLE public.qa_ia_correcoes_juridicas
  ALTER COLUMN trecho_errado DROP NOT NULL,
  ALTER COLUMN trecho_correto DROP NOT NULL;

-- 4) Substituir constraints rígidas por validações condicionais
ALTER TABLE public.qa_ia_correcoes_juridicas
  DROP CONSTRAINT IF EXISTS qa_ia_correcoes_trecho_correto_min,
  DROP CONSTRAINT IF EXISTS qa_ia_correcoes_trecho_errado_min;

ALTER TABLE public.qa_ia_correcoes_juridicas
  ADD CONSTRAINT qa_ia_correcoes_conteudo_coerente CHECK (
    (tipo_registro = 'correcao_erro' AND
       trecho_errado IS NOT NULL AND length(btrim(trecho_errado)) >= 5 AND
       trecho_correto IS NOT NULL AND length(btrim(trecho_correto)) >= 5)
    OR
    (tipo_registro = 'treinamento_direto' AND
       titulo IS NOT NULL AND length(btrim(titulo)) >= 3 AND
       instrucao IS NOT NULL AND length(btrim(instrucao)) >= 10)
  );

-- 5) Índices úteis para a busca por tipo / prioridade
CREATE INDEX IF NOT EXISTS idx_qa_correcoes_tipo_registro_ativo
  ON public.qa_ia_correcoes_juridicas (tipo_registro, ativo);

CREATE INDEX IF NOT EXISTS idx_qa_correcoes_treinamento_global
  ON public.qa_ia_correcoes_juridicas (tipo_peca, ativo)
  WHERE tipo_registro = 'treinamento_direto' AND aplicar_globalmente = true AND ativo = true;

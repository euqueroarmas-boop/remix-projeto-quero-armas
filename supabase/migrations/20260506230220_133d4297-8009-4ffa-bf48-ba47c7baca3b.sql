ALTER TABLE public.qa_municoes_movimentacoes
  ADD COLUMN IF NOT EXISTS ia_status text NOT NULL DEFAULT 'nao_processado',
  ADD COLUMN IF NOT EXISTS ia_dados_extraidos jsonb,
  ADD COLUMN IF NOT EXISTS revisao_obrigatoria boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS documento_revisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS documento_revisado_por uuid;

DO $$ BEGIN
  ALTER TABLE public.qa_municoes_movimentacoes
    ADD CONSTRAINT qa_munmov_ia_status_check
    CHECK (ia_status IN ('nao_processado','processado','pendente_revisao','revisao_obrigatoria','aprovado','reprovado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_qa_munmov_revisao
  ON public.qa_municoes_movimentacoes (cliente_id)
  WHERE revisao_obrigatoria = true;

CREATE OR REPLACE VIEW public.qa_arsenal_fila_revisao AS
SELECT
  'GTE'::text                             AS origem_tabela,
  g.id::text                              AS documento_id,
  g.cliente_id,
  g.storage_path,
  g.nome_original                         AS arquivo_nome,
  g.status_processamento                  AS status,
  COALESCE(g.dados_extraidos_json, '{}'::jsonb) AS ia_dados,
  g.created_at
FROM public.qa_gte_documentos g
WHERE g.status_processamento = 'revisao_obrigatoria'
UNION ALL
SELECT
  'DOCUMENTO_CLIENTE'::text,
  d.id::text,
  d.qa_cliente_id,
  d.arquivo_storage_path,
  d.arquivo_nome,
  d.ia_status,
  COALESCE(d.ia_dados_extraidos, '{}'::jsonb),
  d.created_at
FROM public.qa_documentos_cliente d
WHERE d.ia_status IN ('pendente_revisao','revisao_obrigatoria')
   OR (d.ia_dados_extraidos->>'revisao_obrigatoria')::text = 'true'
UNION ALL
SELECT
  'MUNICAO_NF'::text,
  m.id::text,
  m.cliente_id,
  m.documento_url,
  m.documento_nome,
  m.ia_status,
  COALESCE(m.ia_dados_extraidos, '{}'::jsonb),
  m.created_at
FROM public.qa_municoes_movimentacoes m
WHERE m.revisao_obrigatoria = true;

COMMENT ON VIEW public.qa_arsenal_fila_revisao IS
  'Fila unificada de documentos do Arsenal aguardando revisão da Equipe Quero Armas.';
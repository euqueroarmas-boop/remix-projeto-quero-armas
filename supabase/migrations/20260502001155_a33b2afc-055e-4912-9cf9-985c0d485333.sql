-- Fase 1.2 — Decisão explícita da IA + backfill conservador
ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS decisao_ia text;

COMMENT ON COLUMN public.qa_processo_documentos.decisao_ia IS
  'Decisão explícita da IA: aprovado_auto | rejeitado_auto | revisao_humana | divergente | erro. NUNCA reflete ação manual da Equipe.';

CREATE INDEX IF NOT EXISTS idx_qa_proc_docs_decisao_ia
  ON public.qa_processo_documentos(decisao_ia)
  WHERE decisao_ia IS NOT NULL;

-- Backfill conservador a partir do que já existe.
-- Só consideramos "aprovado_auto" quando a IA concluiu, status final ficou aprovado e confiança alta.
UPDATE public.qa_processo_documentos
   SET decisao_ia = CASE
     WHEN validacao_ia_status = 'concluido'
          AND status = 'aprovado'
          AND validacao_ia_confianca IS NOT NULL
          AND validacao_ia_confianca >= 0.90
       THEN 'aprovado_auto'
     WHEN validacao_ia_status = 'concluido'
          AND status = 'invalido'
       THEN 'rejeitado_auto'
     WHEN validacao_ia_status = 'concluido'
          AND status = 'revisao_humana'
       THEN 'revisao_humana'
     WHEN validacao_ia_status = 'concluido'
          AND status = 'divergente'
       THEN 'divergente'
     WHEN validacao_ia_status = 'erro'
       THEN 'erro'
     ELSE NULL
   END
 WHERE decisao_ia IS NULL
   AND validacao_ia_status IS NOT NULL;
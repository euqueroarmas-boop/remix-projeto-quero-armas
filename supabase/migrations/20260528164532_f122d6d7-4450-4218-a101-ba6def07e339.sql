-- 1) Permite status nao_aplicavel
ALTER TABLE public.qa_processo_documentos
  DROP CONSTRAINT IF EXISTS chk_qa_processo_documentos_status;

ALTER TABLE public.qa_processo_documentos
  ADD CONSTRAINT chk_qa_processo_documentos_status
  CHECK (status = ANY (ARRAY[
    'pendente','enviado','em_analise','aprovado','rejeitado','expirado',
    'invalido','divergente','dispensado_grupo','descartado_por_troca_servico',
    'pendente_reenvio','pre_validado','revisao_humana','nao_aplicavel'
  ]));

-- 2) Arquiva documentos do processo da GTE que saíram do catálogo
UPDATE public.qa_processo_documentos pd
SET status = 'nao_aplicavel',
    campos_complementares_json = COALESCE(pd.campos_complementares_json, '{}'::jsonb)
      || jsonb_build_object(
        'arquivado_em', now(),
        'arquivado_motivo', 'Removido do catálogo do serviço'
      ),
    updated_at = now()
WHERE pd.processo_id = 'ad03c366-b772-43a2-bbdb-85818993fdc0'
  AND (pd.arquivo_url IS NULL OR pd.arquivo_url = '')
  AND pd.status NOT IN ('aprovado','nao_aplicavel')
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = 34
      AND COALESCE((sd.regra_validacao->>'ativo')::boolean, true) = true
      AND LOWER(TRIM(sd.nome_documento)) = LOWER(TRIM(pd.nome_documento))
  );
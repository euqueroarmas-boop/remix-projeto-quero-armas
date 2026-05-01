
ALTER TABLE public.qa_processo_documentos
  DROP CONSTRAINT IF EXISTS chk_qa_processo_documentos_status;

ALTER TABLE public.qa_processo_documentos
  ADD CONSTRAINT chk_qa_processo_documentos_status
  CHECK (status = ANY (ARRAY[
    'pendente','enviado','em_analise','aprovado','rejeitado','expirado',
    'invalido','divergente','dispensado_grupo','descartado_por_troca_servico',
    'pendente_reenvio','pre_validado','revisao_humana'
  ]));

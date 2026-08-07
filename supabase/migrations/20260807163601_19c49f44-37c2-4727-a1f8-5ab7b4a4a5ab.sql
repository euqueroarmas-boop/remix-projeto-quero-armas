ALTER TABLE public.qa_processo_documentos
  ADD CONSTRAINT chk_qa_proc_doc_status_vocabulario
  CHECK (status IN (
    'pendente','pendente_reenvio','aguardando','enviado','fila','processando',
    'em_analise','revisao_humana','pendente_aprovacao',
    'aprovado','reprovado','divergente','invalido','vencido',
    'dispensado','dispensado_grupo','dispensado_por_reaproveitamento','nao_aplicavel',
    'substituido','excluido','descartado_por_troca_servico','cancelado'
  ));

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT chk_qa_doc_cliente_status_vocabulario
  CHECK (status IN (
    'pendente','pendente_aprovacao','pendente_revisao','em_analise','processando','nao_processado',
    'aprovado','reprovado','vencido','substituido','excluido','arquivado'
  ));
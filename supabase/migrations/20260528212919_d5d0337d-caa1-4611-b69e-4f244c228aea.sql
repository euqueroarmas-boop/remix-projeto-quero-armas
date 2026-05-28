ALTER TABLE public.qa_processos DROP CONSTRAINT IF EXISTS chk_qa_processos_status;

ALTER TABLE public.qa_processos
  ADD CONSTRAINT chk_qa_processos_status
  CHECK (status IN (
    'aguardando_pagamento',
    'pagamento_confirmado',
    'aguardando_documentos',
    'em_analise_interna',
    'aguardando_assinatura',
    'pronto_para_protocolar',
    'protocolado',
    'em_analise_orgao',
    'deferido',
    'indeferido',
    'cancelado',
    'concluido'
  ));
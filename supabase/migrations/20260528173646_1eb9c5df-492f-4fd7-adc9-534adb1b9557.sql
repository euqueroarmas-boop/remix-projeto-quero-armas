ALTER TABLE public.qa_processos DROP CONSTRAINT IF EXISTS qa_processos_status_check;
ALTER TABLE public.qa_processos ADD CONSTRAINT qa_processos_status_check CHECK (status = ANY (ARRAY[
  'aguardando_pagamento','aguardando_documentos','em_validacao','pendente_cliente',
  'revisao_humana','validado','bloqueado','cancelado',
  'pronto_para_protocolar','protocolado','em_analise_orgao','deferido','indeferido','concluido'
]));
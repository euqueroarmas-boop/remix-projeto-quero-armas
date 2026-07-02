-- 1) Cancela cobranças duplicadas (não pagas) do cliente 189
UPDATE public.qa_vendas
   SET status = 'CANCELADO',
       cobranca_status = 'cancelada'
 WHERE id IN (286, 287, 288, 291)
   AND status <> 'PAGO';

-- 2) Confirma pagamento no processo já criado, forçando bypass (contrato já foi validado)
SELECT public.qa_confirmar_pagamento_processo(
  '79d5ba9a-cba5-479e-b94f-adf82977f0df'::uuid,
  'contrato_validado_backfill'::text,
  true
);

-- 3) Roda pós-pagamento (protocolo interno + status produção), best-effort
DO $$
BEGIN
  PERFORM public.qa_pos_pagamento_protocolar('79d5ba9a-cba5-479e-b94f-adf82977f0df'::uuid);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
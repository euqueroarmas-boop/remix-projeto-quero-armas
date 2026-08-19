-- ============================================================================
-- AUDITORIA DE PAGAMENTO PRECISA ACEITAR 'manual_admin'
--
-- Achado ao cancelar a venda duplicada do cliente 236: o CHECK de
-- `qa_pagamento_auditoria.origem` só admite webhook_asaas, manual_financeiro,
-- sistema_trigger, backfill, bloqueado e outro — mas duas funções gravam
-- 'manual_admin':
--
--   qa-venda-confirmar-pagamento-manual  (Equipe confirma PIX/dinheiro na mão)
--   qa-piloto-arquivar                   (Equipe arquiva uma venda)
--
-- As duas gravam dentro de try/catch, então o banco recusava a linha em
-- silêncio e ninguém percebia. Resultado: a confirmação manual de pagamento
-- NÃO deixava rastro na auditoria — foi exatamente o que faltou para saber
-- quem marcou as vendas 344 e 345 como pagas.
--
-- Não altera dado existente: só passa a aceitar o valor que o código já usa.
-- ============================================================================

ALTER TABLE public.qa_pagamento_auditoria
  DROP CONSTRAINT IF EXISTS qa_pagamento_auditoria_origem_check;

ALTER TABLE public.qa_pagamento_auditoria
  ADD CONSTRAINT qa_pagamento_auditoria_origem_check
  CHECK (origem IN (
    'webhook_asaas',
    'manual_financeiro',
    'manual_admin',
    'sistema_trigger',
    'backfill',
    'bloqueado',
    'outro'
  ));

-- ── Conferência: o vocabulário aceito agora ─────────────────────────────────
SELECT pg_get_constraintdef(c.oid) AS regra_de_origem
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
 WHERE t.relname = 'qa_pagamento_auditoria'
   AND c.conname = 'qa_pagamento_auditoria_origem_check';

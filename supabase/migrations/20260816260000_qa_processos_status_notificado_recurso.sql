-- ============================================================================
-- qa_processos.status — NOTIFICADO e RECURSO PROTOCOLADO entram no CHECK
-- ----------------------------------------------------------------------------
-- BUG ENCONTRADO EM 16/08/2026, antes de chegar ao cliente.
--
-- A tela em que a equipe cola o que a Policia Federal escreveu grava o status
-- do processo junto com o texto — e dois dos status que ela oferece,
-- `notificado` e `recurso_administrativo`, NAO estao no CHECK desta coluna.
-- O CHECK atual e de 23/06/2026 e para em `deferido`/`indeferido`; a linha do
-- tempo do processo na Policia Federal e mais longa do que isso.
--
-- O sintoma seria o pior possivel: a manifestacao salva, o cliente le o texto
-- do delegado na tela dele, e o processo continua marcado como "em analise".
-- Ou seja, a informacao de que a PF NOTIFICOU — a que abre prazo de 10 dias,
-- a que faz o requerimento ser arquivado se ninguem responder — some, enquanto
-- tudo o mais parece ter funcionado.
--
-- Este bloco e ADITIVO: os 17 status de 20260623204713 continuam identicos e
-- dois sao acrescentados.
--
--   notificado             -- a PF pediu algo; correm 10 dias (Lei 9.784/99)
--   recurso_administrativo -- recurso protocolado, de volta a analise
--
-- `recurso_indeferido` NAO entra aqui de proposito. Negado o recurso, o
-- processo continua `indeferido` — e isso que ele e. A distincao entre
-- "indeferido no pedido" e "indeferido no recurso" vive na manifestacao, que e
-- onde ela decide algo: se ainda cabe recurso, ou se o que resta e o juiz.
--
-- Reexecutavel.
-- ============================================================================

BEGIN;

ALTER TABLE public.qa_processos
  DROP CONSTRAINT IF EXISTS qa_processos_status_check;

ALTER TABLE public.qa_processos
  ADD CONSTRAINT qa_processos_status_check CHECK (
    status = ANY (ARRAY[
      'aguardando_pagamento','aguardando_assinatura','aguardando_documentos',
      'em_validacao','pendente_cliente','revisao_humana','validado','bloqueado',
      'cancelado','pronto_para_protocolar','protocolado','em_analise_orgao',
      'notificado','recurso_administrativo',
      'deferido','indeferido','concluido','pagamento_confirmado','em_analise_interna'
    ])
  );

COMMIT;

-- ── Conferencia ─────────────────────────────────────────────────────────────
-- As duas colunas tem que voltar `true`:
--
-- SELECT pg_get_constraintdef(oid) LIKE '%notificado%'             AS tem_notificado,
--        pg_get_constraintdef(oid) LIKE '%recurso_administrativo%' AS tem_recurso
--   FROM pg_constraint
--  WHERE conname = 'qa_processos_status_check';

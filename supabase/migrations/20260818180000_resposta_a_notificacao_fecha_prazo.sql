-- ============================================================================
-- RESPONDER A NOTIFICAÇÃO FECHA O PRAZO
-- ----------------------------------------------------------------------------
-- Achado da TERCEIRA auditoria (18/08/2026), furo 2.
--
-- O motor de prazos tinha UM fechador: `data_recurso_administrativo`. Só que
-- responder a uma notificação NÃO é recorrer — e responder é o caminho mais
-- comum de todos. A PF pede um documento, o cliente entrega, a equipe protocola
-- a resposta dentro do prazo… e nada no sistema registrava esse ato.
--
-- Resultado: o contador de 10 dias seguia correndo. O cron mandava "prazo
-- VENCIDO há N dias" para o cliente e para a equipe, todo dia, para sempre, num
-- processo que foi respondido no prazo. É o mesmo alarme falso do caso do Edmar
-- (fechado na primeira auditoria) no ramo do indeferimento — intacto no ramo da
-- notificação, que é o mais movimentado.
--
-- ── O QUE ESTA MIGRATION ACRESCENTA ─────────────────────────────────────────
--   qa_itens_venda.data_resposta_notificacao
--       A data em que a resposta foi entregue à PF. É o que desliga o alarme.
--       Fecha o prazo de NOTIFICAÇÃO e de RESTITUIÇÃO — nunca o de
--       INDEFERIMENTO, que só se resolve recorrendo. Essa distinção vive no
--       código (`prazosProcessuais.ts`, nas duas cópias).
--
--   qa_processo_manifestacoes_pf.respondida_em / respondida_protocolo /
--   respondida_por
--       Quando, com que número e por quem. Sem isto, abrir uma notificação
--       antiga não diz se ela já foi respondida — e a equipe responde de novo
--       ou deixa de responder, sem forma de saber qual dos dois.
--
-- Só acrescenta coluna. Nada é removido, nada muda de nome. Reexecutável.
-- ============================================================================

BEGIN;

ALTER TABLE public.qa_itens_venda
  ADD COLUMN IF NOT EXISTS data_resposta_notificacao date;

COMMENT ON COLUMN public.qa_itens_venda.data_resposta_notificacao IS
  'Data em que a resposta à notificação foi entregue à PF. Fecha o prazo de 10 dias de NOTIFICAÇÃO e RESTITUIÇÃO (nunca o de indeferimento).';

ALTER TABLE public.qa_processo_manifestacoes_pf
  ADD COLUMN IF NOT EXISTS respondida_em        timestamptz,
  ADD COLUMN IF NOT EXISTS respondida_protocolo text,
  ADD COLUMN IF NOT EXISTS respondida_por       uuid;

COMMENT ON COLUMN public.qa_processo_manifestacoes_pf.respondida_em IS
  'Quando a equipe registrou a entrega da resposta à PF. NULL = ainda em aberto.';
COMMENT ON COLUMN public.qa_processo_manifestacoes_pf.respondida_protocolo IS
  'Número do protocolo da resposta na PF, quando houver.';

-- Busca da manifestação em aberto de um processo — é o que a tela da equipe faz
-- ao abrir o processo, e o que a edge function faz quando não recebe o id.
CREATE INDEX IF NOT EXISTS idx_qa_manifestacoes_pf_em_aberto
  ON public.qa_processo_manifestacoes_pf (processo_id, created_at DESC)
  WHERE respondida_em IS NULL;

COMMIT;

-- ── CONFERÊNCIA 1 — as colunas existem ──────────────────────────────────────
-- Esperado: 4 linhas.
--
-- SELECT table_name, column_name
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND ((table_name = 'qa_itens_venda' AND column_name = 'data_resposta_notificacao')
--      OR (table_name = 'qa_processo_manifestacoes_pf'
--          AND column_name IN ('respondida_em','respondida_protocolo','respondida_por')))
--  ORDER BY table_name, column_name;

-- ── CONFERÊNCIA 2 — quem está sendo alarmado à toa AGORA ────────────────────
-- Lista os processos com notificação aberta há mais de 10 dias e sem resposta
-- registrada. Cada linha é um cliente que pode estar recebendo "prazo vencido"
-- indevidamente — ou um prazo de verdade estourado. As duas hipóteses pedem a
-- mesma ação: abrir o processo e registrar a resposta, se ela já foi entregue.
--
-- SELECT p.id                AS processo,
--        c.nome_completo     AS cliente,
--        i.data_notificacao,
--        i.data_resposta_notificacao,
--        CURRENT_DATE - i.data_notificacao AS dias_desde_a_notificacao,
--        m.respondida_em
--   FROM public.qa_processos p
--   JOIN public.qa_clientes  c ON c.id = p.cliente_id
--   JOIN public.qa_vendas    v ON v.id = p.venda_id
--   JOIN public.qa_itens_venda i
--     ON i.venda_id = COALESCE(v.id_legado, v.id)
--    AND i.servico_id = p.servico_id
--   LEFT JOIN LATERAL (
--        SELECT respondida_em
--          FROM public.qa_processo_manifestacoes_pf mm
--         WHERE mm.processo_id = p.id
--         ORDER BY mm.created_at DESC
--         LIMIT 1
--   ) m ON true
--  WHERE i.data_notificacao IS NOT NULL
--    AND i.data_resposta_notificacao IS NULL
--    AND i.data_recurso_administrativo IS NULL
--    AND i.data_indeferimento_recurso IS NULL
--    AND COALESCE(i.status, '') NOT IN ('DEFERIDO','CONCLUIDO','CANCELADO','DESISTIU')
--  ORDER BY i.data_notificacao;

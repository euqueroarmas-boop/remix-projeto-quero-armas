-- ============================================================================
-- A GRU PASSA A SER ETAPA FINAL — não se cobra taxa antes de a equipe liberar
-- ----------------------------------------------------------------------------
-- O boleto da GRU já nascia com a instrução "só pague DEPOIS que a nossa equipe
-- liberar o seu requerimento". Só que isso era TEXTO. A trava de verdade — a
-- marca `etapa_final`, criada em 16/08 — cobria apenas o acesso ao gov.br e a
-- juntada assinada. A GRU ficou de fora.
--
-- Consequência real (Anthony, 18/08, 23:21): terminou de entregar tudo, o grupo
-- "Requerimento" virou o grupo da vez e o portal abriu com "você está nos
-- devendo enviar esses documentos!" oferecendo o boleto de R$ 88 — antes de a
-- equipe ter montado a defesa dele. A decisão de quando pagar não pode depender
-- de o cliente ler o aviso com atenção.
--
-- Ordem correta: a equipe fecha a documentação e marca o processo como pronto
-- para protocolar → o cliente paga a GRU, manda o comprovante, libera o gov.br
-- e assina a juntada.
--
-- Por que isso NÃO trava o processo: exigência de etapa final não conta para
-- "documentação completa". Se contasse, o processo nunca chegaria a
-- `pronto_para_protocolar` e a GRU nunca apareceria — uma esperando a outra.
-- O código já trata assim (`itemContaParaConclusao`).
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- 1) CATÁLOGO — vale para todo processo criado daqui para frente.
UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
                         || '{"etapa_final":true}'::jsonb,
       updated_at = now()
 WHERE ativo
   AND tipo_documento IN ('gru', 'gru_boleto', 'gru_comprovante', 'gru_paga');

-- 2) PROCESSOS JÁ ABERTOS — o checklist deles já foi explodido e não relê o
--    catálogo. Sem esta parte, o Anthony e todo mundo com processo em curso
--    continuariam vendo o boleto na fila.
UPDATE public.qa_processo_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
                         || '{"etapa_final":true}'::jsonb,
       updated_at = now()
 WHERE tipo_documento IN ('gru', 'gru_boleto', 'gru_comprovante', 'gru_paga')
   AND COALESCE(regra_validacao ->> 'etapa_final', 'false') <> 'true';

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Os quatro passos do bloco final, todos com etapa_final = true:
--
-- SELECT tipo_documento, nome_documento, ordem,
--        regra_validacao ->> 'etapa_final' AS etapa_final
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 60
--    AND tipo_documento IN ('gru','gru_comprovante','credencial_gov_br','juntada_assinada')
--  ORDER BY ordem;
--
-- E o checklist do Anthony (cliente 218) — gru e gru_comprovante marcados:
--
-- SELECT d.ordem, d.tipo_documento, d.status,
--        d.regra_validacao ->> 'etapa_final' AS etapa_final
--   FROM public.qa_processo_documentos d
--   JOIN public.qa_processos p ON p.id = d.processo_id
--  WHERE p.cliente_id = 218
--  ORDER BY d.ordem;

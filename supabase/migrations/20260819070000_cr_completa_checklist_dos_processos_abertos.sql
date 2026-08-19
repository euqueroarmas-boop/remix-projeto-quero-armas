-- ============================================================================
-- CR: completa o checklist dos processos que nasceram com a versão antiga
-- ----------------------------------------------------------------------------
-- Estado antes deste bloco (conferido em 19/08/2026):
--
--   1c6bcebc… · protocolado             · 21 exigências · catálogo: 46
--   59721348… · aguardando_documentos   · 25 exigências · catálogo: 46
--   5b40d778… · aguardando_documentos   · 30 exigências · catálogo: 46
--
-- Os três nasceram com o checklist antigo do CR, que não tinha ocupação lícita,
-- requerimento do Sinarm-CAC, taxa, DSA nem DEGA. Os dois ABERTOS precisam
-- receber o que falta — senão a pasta vai para a Polícia Federal incompleta.
--
-- O acerto é `qa_explodir_checklist_processo`, que é a função que monta o
-- checklist quando o processo nasce. Ela é ADITIVA por construção: insere
-- apenas o que ainda não existe naquele processo (`NOT EXISTS` por
-- `tipo_documento`) e nunca apaga nem duplica. Rodar duas vezes seguidas não
-- muda nada na segunda.
--
-- O PROTOCOLADO FICA DE FORA, de propósito. A pasta dele já foi entregue à PF;
-- acrescentar exigência agora não muda o que foi protocolado, só faria o
-- cliente ver pendência nova em processo que já saiu daqui. Se a PF exigir algo
-- daquele processo, o caminho é a exigência da PF (grupo `exigencias_pf`), que
-- passa na frente de tudo e tem fluxo próprio.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  r        record;
  v_res    record;
  v_antes  integer;
  v_depois integer;
BEGIN
  FOR r IN
    SELECT p.id, p.status
      FROM public.qa_processos p
     WHERE p.servico_id = 44
       AND public.qa_processo_em_aberto(p.status)
     ORDER BY p.created_at
  LOOP
    SELECT count(*) INTO v_antes
      FROM public.qa_processo_documentos WHERE processo_id = r.id;

    SELECT * INTO v_res
      FROM public.qa_explodir_checklist_processo(r.id);

    SELECT count(*) INTO v_depois
      FROM public.qa_processo_documentos WHERE processo_id = r.id;

    RAISE NOTICE 'Processo % (%): % -> % exigências (inseridas %, já existentes %, reaproveitadas do cofre %)',
      r.id, r.status, v_antes, v_depois,
      v_res.inseridos, v_res.ja_existentes, v_res.reaproveitados_cofre;
  END LOOP;
END $$;

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Os dois processos abertos precisam bater com o catálogo. O protocolado
-- continua com o número antigo, e isso é o esperado:
--
-- SELECT p.id, p.status, p.modalidade,
--        count(pd.id) AS exigencias_no_processo,
--        (SELECT count(*) FROM public.qa_servicos_documentos sd
--          WHERE sd.servico_id = 44 AND sd.ativo) AS exigencias_no_catalogo
--   FROM public.qa_processos p
--   LEFT JOIN public.qa_processo_documentos pd ON pd.processo_id = p.id
--  WHERE p.servico_id = 44
--  GROUP BY p.id, p.status, p.modalidade
--  ORDER BY p.status, p.id;
--
-- Observação: o número do processo aberto pode ficar ABAIXO de 46 sem ser erro.
-- Exigência condicionada à condição profissional (as de renda) só entra na
-- condição que aquele cliente tem, e a do Ibama não entra porque ele é
-- atirador, não caçador. O que não pode acontecer é faltar exigência
-- incondicional — requerimento, taxa, certidões, DSA:
--
-- SELECT sd.tipo_documento, sd.nome_documento
--   FROM public.qa_servicos_documentos sd
--  WHERE sd.servico_id = 44 AND sd.ativo
--    AND sd.condicao_profissional IS NULL
--    AND sd.condicao_modalidade IS NULL
--    -- `renda_definir_condicao` é o placeholder que some quando a condição
--    -- profissional já está definida: ele some justamente porque os documentos
--    -- de renda reais entraram no lugar. Ausência dele não é falta.
--    AND sd.tipo_documento <> 'renda_definir_condicao'
--    AND NOT EXISTS (
--      SELECT 1 FROM public.qa_processo_documentos pd
--       WHERE pd.processo_id = '<id do processo>'
--         AND pd.tipo_documento = sd.tipo_documento)
--  ORDER BY sd.ordem;
--
-- Esperado: zero linhas para cada processo aberto.

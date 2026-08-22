-- =============================================================================
-- APAGA O CATÁLOGO ÓRFÃO DO SERVIÇO 31
-- -----------------------------------------------------------------------------
-- Decisão do titular (21/08/2026): "Apagar".
--
-- ─── O QUE É O 31 ────────────────────────────────────────────────────────────
--
-- O catálogo antigo de POSSE DE ARMA DE FOGO — o dossiê civil pela Polícia
-- Federal. Dá para reconhecer pelo conteúdo: as cinco certidões de antecedentes,
-- laudo psicológico, capacidade técnica, declaração de não responder inquérito e
-- as perguntas sobre o comprovante de endereço. Nas migrations de maio e junho
-- ele é chamado de "Posse", sempre em par com o 44.
--
-- Ele foi abandonado. Conferido no banco em 21/08/2026:
--   - NÃO existe linha dele em qa_servicos_catalogo;
--   - NÃO existe processo apontando para ele — nem aberto, nem encerrado;
--   - sobraram 18 linhas em qa_servicos_documentos penduradas num número morto.
--
-- Na prática foi substituído pelo 60 (Autorização de compra / Posse) e pelo 59
-- (CRAF e GT / Posse).
--
-- ─── A REGRA DESTA LIMPEZA ───────────────────────────────────────────────────
--
-- Apagar catálogo é barato; apagar HISTÓRIA não tem volta. Por isso a migration
-- separa as tabelas em dois grupos e trata cada um de um jeito:
--
--   CONFIGURAÇÃO — é o desenho do serviço, e some:
--     qa_servicos_documentos, qa_servicos_documentos_snapshots,
--     qa_checklist_grupos, qa_servico_documentos_obrigatorios,
--     qa_tipos_documento_servicos, qa_servicos_com_exame,
--     qa_regras_categoria, qa_document_examples
--
--   TRANSACIONAL — é registro do que aconteceu com cliente, e NÃO É TOCADO:
--     qa_processos, qa_itens_venda, qa_protocolos, qa_procuracoes,
--     qa_solicitacoes_servico, qa_checklist_rascunhos
--
-- Se QUALQUER linha transacional apontar para o 31, a migration ABORTA dizendo
-- qual tabela é — nada é apagado, e a decisão volta para você. Do jeito que o
-- banco está hoje, isso não acontece: todas estão zeradas.
--
-- Também aborta se o serviço 31 tiver voltado a existir no catálogo — nesse
-- caso ele não é órfão, e apagar o desenho dele seria estrago.
--
-- Reexecutável: rodar de novo não encontra mais nada e não faz nada.
-- =============================================================================

BEGIN;

DO $limpeza$
DECLARE
  v_tab      text;
  v_qtd      bigint;
  v_bloqueio text := '';
  v_apagado  bigint;
  v_total    bigint := 0;
  -- Tabelas que guardam o que ACONTECEU. Nenhuma delas é tocada; a existência
  -- de uma única linha já cancela a limpeza inteira.
  c_transacional constant text[] := ARRAY[
    'qa_processos', 'qa_itens_venda', 'qa_protocolos',
    'qa_procuracoes', 'qa_solicitacoes_servico', 'qa_checklist_rascunhos'
  ];
  -- Tabelas que guardam o DESENHO do serviço. São essas que somem.
  c_configuracao constant text[] := ARRAY[
    'qa_servicos_documentos', 'qa_servicos_documentos_snapshots',
    'qa_checklist_grupos', 'qa_servico_documentos_obrigatorios',
    'qa_tipos_documento_servicos', 'qa_servicos_com_exame',
    'qa_regras_categoria', 'qa_document_examples'
  ];
BEGIN
  -- ── Trava 1: o serviço voltou a existir? Então não é órfão. ────────────────
  IF EXISTS (SELECT 1 FROM public.qa_servicos_catalogo WHERE servico_id = 31) THEN
    RAISE EXCEPTION 'ABORTADO: o servico 31 EXISTE em qa_servicos_catalogo. Ele nao e orfao — apagar o catalogo dele seria estrago.';
  END IF;

  -- ── Trava 2: alguma coisa transacional aponta para ele? ───────────────────
  FOREACH v_tab IN ARRAY c_transacional LOOP
    IF to_regclass('public.' || v_tab) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE servico_id = 31', v_tab) INTO v_qtd;
    IF COALESCE(v_qtd, 0) > 0 THEN
      v_bloqueio := v_bloqueio || format('%s (%s linha(s)); ', v_tab, v_qtd);
    END IF;
  END LOOP;

  IF v_bloqueio <> '' THEN
    RAISE EXCEPTION 'ABORTADO: existe registro de cliente apontando para o servico 31 — %. Nada foi apagado. Decida o que fazer com esses registros antes de limpar o catalogo.', v_bloqueio;
  END IF;

  -- ── A limpeza ─────────────────────────────────────────────────────────────
  FOREACH v_tab IN ARRAY c_configuracao LOOP
    IF to_regclass('public.' || v_tab) IS NULL THEN
      RAISE NOTICE 'Tabela % nao existe neste banco — pulando.', v_tab;
      CONTINUE;
    END IF;
    EXECUTE format('DELETE FROM public.%I WHERE servico_id = 31', v_tab);
    GET DIAGNOSTICS v_apagado = ROW_COUNT;
    v_total := v_total + v_apagado;
    IF v_apagado > 0 THEN
      RAISE NOTICE 'Servico 31: % linha(s) apagada(s) de %.', v_apagado, v_tab;
    END IF;
  END LOOP;

  RAISE NOTICE 'Servico 31: % linha(s) de configuracao apagada(s) no total.', v_total;
END
$limpeza$;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) Não sobrou nada de configuração apontando para o 31. Esperado: tudo 0.
--
-- SELECT
--   (SELECT count(*) FROM public.qa_servicos_documentos            WHERE servico_id = 31) AS documentos,
--   (SELECT count(*) FROM public.qa_servicos_documentos_snapshots  WHERE servico_id = 31) AS snapshots,
--   (SELECT count(*) FROM public.qa_checklist_grupos               WHERE servico_id = 31) AS grupos,
--   (SELECT count(*) FROM public.qa_servico_documentos_obrigatorios WHERE servico_id = 31) AS obrigatorios,
--   (SELECT count(*) FROM public.qa_tipos_documento_servicos       WHERE servico_id = 31) AS tipos,
--   (SELECT count(*) FROM public.qa_servicos_com_exame             WHERE servico_id = 31) AS exames,
--   (SELECT count(*) FROM public.qa_regras_categoria               WHERE servico_id = 31) AS regras,
--   (SELECT count(*) FROM public.qa_document_examples              WHERE servico_id = 31) AS exemplos;
--
-- B) E nada transacional foi tocado — continua tudo em 0, como antes.
--
-- SELECT
--   (SELECT count(*) FROM public.qa_processos            WHERE servico_id = 31) AS processos,
--   (SELECT count(*) FROM public.qa_itens_venda          WHERE servico_id = 31) AS itens_venda,
--   (SELECT count(*) FROM public.qa_protocolos           WHERE servico_id = 31) AS protocolos,
--   (SELECT count(*) FROM public.qa_procuracoes          WHERE servico_id = 31) AS procuracoes,
--   (SELECT count(*) FROM public.qa_solicitacoes_servico WHERE servico_id = 31) AS solicitacoes,
--   (SELECT count(*) FROM public.qa_checklist_rascunhos  WHERE servico_id = 31) AS rascunhos;
-- =============================================================================

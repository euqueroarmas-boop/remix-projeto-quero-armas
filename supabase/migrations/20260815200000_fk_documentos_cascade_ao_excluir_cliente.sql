-- =============================================================================
-- Excluir cliente passa a apagar os documentos dele (ON DELETE CASCADE)
--
-- Hoje a FK é ON DELETE SET NULL: apagar o cadastro zera o vínculo e os
-- documentos sobrevivem sem dono — invisíveis em toda consulta por cliente, no
-- portal e no painel. Foi assim que nasceram os três órfãos de 15/08/2026, dois
-- deles do Anthony (conta de luz e CNH) e um do Porges, todos com status
-- 'aprovado' e pertencendo a clientes (207 e 217) que não existem mais.
--
-- Decisão do usuário (15/08/2026): apagou o cliente, apagam-se os documentos.
--
-- O histórico NÃO se perde nisso: a trilha em qa_documentos_cliente_eventos
-- passou a ter ON DELETE SET NULL na migration 20260815180000, então os eventos
-- de cada documento sobrevivem à remoção — que é exatamente o que a regra
-- canônica de docs/RASTRO-DOCUMENTAL.md exige.
--
-- ATENÇÃO ao efeito em cadeia: apagar documento dispara
-- trg_qa_doc_removido_reabre_exigencia, que reabre exigências de processos EM
-- ABERTO ligadas àquele arquivo. Na prática isso não acontece na exclusão de
-- cliente, porque o admin já bloqueia excluir quem tem vínculo crítico
-- (qa_cliente_dependencias) e obriga arquivar — mas fica registrado aqui para
-- quem for mexer nessa ordem depois.
-- =============================================================================

BEGIN;

DO $fk$
DECLARE
  v_con text;
  v_regra text;
BEGIN
  SELECT c.conname, pg_get_constraintdef(c.oid) INTO v_con, v_regra
    FROM pg_constraint c
   WHERE c.conrelid = 'public.qa_documentos_cliente'::regclass
     AND c.contype = 'f'
     AND c.confrelid = 'public.qa_clientes'::regclass
     AND c.conkey = ARRAY[(
       SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = 'public.qa_documentos_cliente'::regclass
          AND a.attname = 'qa_cliente_id'
     )];

  IF v_con IS NULL THEN
    RAISE EXCEPTION 'FK de qa_documentos_cliente.qa_cliente_id → qa_clientes não encontrada.';
  END IF;

  RAISE NOTICE 'FK atual (%): %', v_con, v_regra;

  EXECUTE format('ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT %I', v_con);
END
$fk$;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_documentos_cliente_qa_cliente_id_fkey
  FOREIGN KEY (qa_cliente_id)
  REFERENCES public.qa_clientes(id)
  ON DELETE CASCADE;

COMMIT;

-- =============================================================================
-- Documentos sem dono: remoção dos três existentes + trava para não repetir
--
-- Achado (15/08/2026): três documentos com status 'aprovado' e SEM nenhum dos
-- dois vínculos de cliente — `qa_cliente_id` e `customer_id` nulos ao mesmo
-- tempo. Não aparecem em consulta por cliente, não aparecem no portal nem no
-- painel, e são documentos pessoais (uma CNH, uma conta de consumo, um extrato).
--
-- Por que remover em vez de vincular:
--   • Nenhum deles cumpre exigência de ninguém. Sem dono, a trigger
--     qa_doc_hub_satisfaz_exigencias_processo sai antes de agir — o checklist
--     dos clientes 217 e 207 nunca os contou e continua pedindo esses
--     documentos. Remover não altera o estado de processo nenhum.
--   • Os tipos estão TROCADOS: o arquivo "…CNH-e.pdf" foi gravado como
--     'comprovante_residencia'. Vincular ao cliente que o caminho sugere faria
--     a trigger fechar a exigência de comprovante de residência com uma
--     habilitação — pior do que o problema atual.
--   • Dado pessoal sem titular vinculado não tem como ser atendido num pedido
--     de exclusão de titular.
--
-- De onde vieram: o modal do Hub grava `qa_cliente_id: qaClienteId ?? null` e
-- `customer_id: customerId ?? null`. Com a tela aberta sem cliente resolvido,
-- nasce o órfão. As edge functions não têm essa brecha — qa-arsenal-doc-autoinsert
-- devolve 400 quando faltam os dois, e as demais sempre preenchem qa_cliente_id.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) REMOÇÃO — ids explícitos, e só se AINDA estiverem sem dono
--    A cláusula de vínculo nulo é proposital: se alguém tiver vinculado o
--    documento entre a conferência e a execução, nada é apagado.
-- ─────────────────────────────────────────────────────────────────────────────
DO $del$
DECLARE v_apagados integer;
BEGIN
  WITH alvo AS (
    DELETE FROM public.qa_documentos_cliente d
     WHERE d.id IN (
       -- qa-217 · "…00000091-CNH-e.pdf.pdf" gravado como comprovante_residencia
       '8989cd11-16d5-4cc6-abce-d46ca21afaba',
       -- qa-207 · "…extrato_boleto…pdf" gravado como comprovante_residencia
       '1a93498b-6886-4856-9598-c50398f94451',
       -- qa-217 · "…00000090-000156313600466.pdf" gravado como antecedentes_militar
       -- (este tem cópia preservada: mesmo eTag vinculado ao cliente 218)
       'eb42627e-17fc-4d25-a183-83db73b227ec'
     )
       AND d.qa_cliente_id IS NULL
       AND d.customer_id IS NULL
    RETURNING d.id
  )
  SELECT count(*) INTO v_apagados FROM alvo;

  RAISE NOTICE 'Documentos sem dono removidos: % de 3.', v_apagados;
  IF v_apagados < 3 THEN
    RAISE NOTICE 'Os não removidos ganharam vínculo depois da conferência — confira antes de insistir.';
  END IF;
END
$del$;

-- Os arquivos correspondentes continuam no bucket e entram na lista de órfãos
-- de storage (218 objetos / 75 MB medidos em 15/08), tratada em etapa própria.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) TRAVA — documento precisa de pelo menos um vínculo de cliente
--
--    NOT VALID de propósito: a constraint passa a valer para tudo que entrar,
--    sem exigir que o histórico antigo esteja limpo. Linhas já excluídas
--    logicamente podem estar sem vínculo, e travar a migration por causa delas
--    seria trocar um problema silencioso por um bloqueio de deploy.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_exige_vinculo;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_exige_vinculo
  CHECK (qa_cliente_id IS NOT NULL OR customer_id IS NOT NULL)
  NOT VALID;

-- Tenta promover a constraint a validada. Se ainda houver linha antiga sem
-- vínculo, apenas informa quantas são — a trava continua ativa para novos.
DO $val$
DECLARE v_restantes integer;
BEGIN
  BEGIN
    ALTER TABLE public.qa_documentos_cliente VALIDATE CONSTRAINT qa_doc_cliente_exige_vinculo;
    RAISE NOTICE 'Constraint validada: nenhuma linha sem vínculo no histórico.';
  EXCEPTION WHEN check_violation THEN
    SELECT count(*) INTO v_restantes
      FROM public.qa_documentos_cliente
     WHERE qa_cliente_id IS NULL AND customer_id IS NULL;
    RAISE NOTICE 'Constraint ativa para novos registros, mas % linha(s) antiga(s) seguem sem vínculo (provavelmente com status excluido). Limpe e rode VALIDATE CONSTRAINT depois.', v_restantes;
  END;
END
$val$;

COMMIT;

-- =============================================================================
-- 1) Fecha regressão introduzida hoje  2) Tipos que o frontend usa e o CHECK recusa
--
-- ─── PARTE 1 — o apelido militar reabria o buraco de 31/07 ───────────────
--
-- Em 20260807120000 eu re-adicionei:
--     ('certidao_antecedentes_criminais_militar', 'antecedentes_militar')
--
-- A justificativa era pegar documentos TJM antigos, gravados no Hub sob o
-- tipo genérico. Confiei no filtro textual que a mesma migration acrescentou
-- ao RPC qa_reaproveitar_documentos_hub_processo.
--
-- O erro: o RPC não é o único motor. `qa_processo_rever_exigencias` também
-- casa documento × exigência, faz join DIRETO na tabela de apelidos sem
-- nenhum filtro textual, e marca `status='aprovado'`. Ela é chamada pelo
-- frontend a cada aprovação no Hub e por dezenas de migrations.
--
-- Consequência: uma certidão do STM (União) aprovada no Hub dispensava a
-- exigência do TJM (Estadual) — exatamente o que a migration de 31/07
-- ("separa_militar_estadual_da_uniao") existiu para impedir.
--
-- O apelido também não entregava o que prometia: a própria 20260807120000
-- reclassifica para `antecedentes_militar_estadual` todo documento do Hub
-- cujo texto identifica TJM. Documento SEM marcador de TJM não passaria no
-- filtro textual do RPC de qualquer forma. O apelido era, portanto, risco
-- puro sem ganho.
--
-- ─── PARTE 2 — três tipos que o frontend declara e o banco recusa ────────
--
-- `hubTipoMap.ts` lista em HUB_TIPOS_VALIDOS três tipos ausentes do CHECK:
--     documento_identificacao_terceiro
--     requerimento_de_posse_de_arma_de_fogo
--     habilitacao_cacador_ibama
--
-- `toHubTipoCompartilhado()` existe para garantir tipo válido — a rede de
-- proteção `HUB_TIPOS_VALIDOS.has(mapped) ? mapped : "outro"` falha porque o
-- Set afirma que são válidos. O INSERT vai ao banco e viola o CHECK (23514).
--
-- Os três são documentos reais e exigidos pelo catálogo de serviços:
--   documento_identificacao_terceiro      — 20260724000000, identidade do
--                                           responsável pelo imóvel
--   requerimento_de_posse_de_arma_de_fogo — 20260724000000, o requerimento
--   habilitacao_cacador_ibama             — 20260519011039, licença do IBAMA
--
-- Cabem no Hub por direito próprio. Rebaixá-los para 'outro' os gravaria sem
-- tipo e nenhum deles voltaria a satisfazer exigência alguma.
--
-- Ampliar um CHECK nunca invalida linha existente.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── PARTE 1 ─────────────────────────────────────────────────────────────
DELETE FROM public.qa_tipo_documento_aliases
 WHERE processo_tipo = 'certidao_antecedentes_criminais_militar'
   AND hub_tipo = 'antecedentes_militar';

-- ─── PARTE 2 ─────────────────────────────────────────────────────────────
-- Acrescenta sem transcrever a lista inteira: o texto atual da constraint é
-- preservado e ampliado, como fez 20260731100000.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';

  IF v_def IS NULL THEN
    RAISE NOTICE 'Constraint qa_doc_cliente_tipo_check não encontrada — nada a alterar.';
  ELSIF v_def LIKE '%habilitacao_cacador_ibama%' THEN
    RAISE NOTICE 'Tipos já presentes no CHECK.';
  ELSE
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check';
    EXECUTE replace(
      'ALTER TABLE public.qa_documentos_cliente ADD CONSTRAINT qa_doc_cliente_tipo_check ' || v_def,
      '''outro''',
      '''outro'',''documento_identificacao_terceiro'',''requerimento_de_posse_de_arma_de_fogo'',''habilitacao_cacador_ibama'''
    );
  END IF;
END $$;

COMMIT;

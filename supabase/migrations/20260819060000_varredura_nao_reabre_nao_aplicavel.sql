-- =============================================================================
-- A VARREDURA DIÁRIA PARA DE RESSUSCITAR EXIGÊNCIA "NÃO APLICÁVEL"
--
-- ACHADO (19/08/2026, ao conferir o alcance da varredura de vencimento).
-- `qa_reabrir_exigencias_documento_invalido` reabre QUALQUER exigência cujo
-- status seja diferente de 'pendente' e cujo documento no acervo esteja
-- reprovado ou vencido. Inclusive as marcadas `nao_aplicavel`.
--
-- Caso concreto: PEDRO LOBATO DE LIMA é APOSENTADO. A exigência
-- `renda_extrato_inss` está `nao_aplicavel` — para aposentado o catálogo pede o
-- comprovante de benefício, não o extrato. Mas o arquivo dele no acervo tem
-- `data_validade = 2026-09-09`. Em 10/09, a varredura acharia a linha (o
-- storage key bate) e a devolveria para `pendente` — o sistema voltaria a
-- cobrar de um aposentado um documento que o próprio catálogo diz que não se
-- aplica a ele.
--
-- CORREÇÃO: `nao_aplicavel` é decisão de catálogo/equipe sobre a PESSOA, não
-- estado do arquivo. Vencimento de arquivo não pode desfazer essa decisão.
--
-- O QUE NÃO MUDA, de propósito: `dispensado`, `dispensado_grupo` e
-- `dispensado_por_reaproveitamento` continuam sendo reabertos quando o
-- documento vence. Ali a exigência SE APLICA — foi só cumprida por um arquivo
-- de outro processo; se esse arquivo venceu, tem mesmo que ser cobrada de novo.
--
-- ── Por que PATCH e não CREATE OR REPLACE ───────────────────────────────────
-- Mesmo motivo de 20260815170000: o corpo vivo em produção já recebeu o
-- parâmetro `p_storage_path` por patch. Recriar a função a partir do arquivo
-- original (20260801010000) apagaria isso em silêncio. Lemos o corpo vivo,
-- trocamos só a âncora, e falhamos com exceção se a âncora não existir.
--
-- Idempotente: se o corpo vivo já tiver 'nao_aplicavel', não faz nada.
-- =============================================================================

BEGIN;

DO $migration$
DECLARE
  v_oid  oid;
  v_def  text;
  v_novo text;
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'qa_reabrir_exigencias_documento_invalido'
   ORDER BY p.pronargs DESC
   LIMIT 1;

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'qa_reabrir_exigencias_documento_invalido não encontrada.';
  END IF;

  v_def := pg_get_functiondef(v_oid);

  IF position('nao_aplicavel' in v_def) > 0 THEN
    RAISE NOTICE 'Guarda de nao_aplicavel já presente no corpo vivo. Nada a fazer.';
    RETURN;
  END IF;

  IF position('AND pd.status <> ''pendente''' in v_def) = 0 THEN
    RAISE EXCEPTION
      'Âncora (pd.status <> ''pendente'') não encontrada no corpo vivo da função — '
      'o corpo em produção mudou. Reveja o patch antes de aplicar.';
  END IF;

  v_novo := replace(
    v_def,
    'AND pd.status <> ''pendente''',
    '-- Vencimento de arquivo não desfaz decisão sobre a PESSOA:' || E'\n' ||
    '       -- exigência marcada nao_aplicavel nunca volta a ser cobrada aqui.' || E'\n' ||
    '       AND pd.status NOT IN (''pendente'', ''nao_aplicavel'')'
  );

  EXECUTE v_novo;
END
$migration$;

COMMIT;

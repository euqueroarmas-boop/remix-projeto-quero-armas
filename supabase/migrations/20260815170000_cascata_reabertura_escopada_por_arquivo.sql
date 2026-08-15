-- =============================================================================
-- Cascata de reabertura: escopo por ARQUIVO, não varredura global
--
-- Sintoma (usuário, 15/08/2026): rejeitar a certidão SJSP/JEF de um cliente
-- reabria exigência em processo de OUTRO cliente. Prova em qa_processo_eventos:
-- em 2026-08-10 17:52:27.995222 — mesmo microssegundo, mesmo disparo — dois
-- processos distintos foram reabertos, um por certidão reprovada e outro por
-- comprovante de residência VENCIDO cujo documento estava aprovado. O segundo
-- não tem relação nenhuma com o documento que foi rejeitado.
--
-- Causa: o trigger trg_qa_doc_invalidado_reabre reage por linha, mas chama
-- qa_reabrir_exigencias_documento_invalido() SEM parâmetro, e a função varre a
-- base inteira. Um clique de rejeição vira faxina global.
--
-- Correção: a função ganha p_storage_path.
--   • preenchido → reabre só a exigência sustentada por AQUELE arquivo (trigger)
--   • NULL       → varredura completa, que é o uso do ciclo diário na edge
--                  function qa-vencimentos-alertas (rpc sem argumento)
--
-- O trigger também ganha guarda: documento sem arquivo não dispara nada. Sem
-- isso, uma linha com arquivo_storage_path nulo passaria NULL adiante e faria
-- exatamente a varredura global que esta migration remove.
--
-- ── Por que PATCH e não CREATE OR REPLACE ────────────────────────────────────
-- O corpo destas funções em produção pode divergir do arquivo que as criou
-- (20260801010000). Recriá-las a partir dele reverteria em silêncio qualquer
-- ajuste posterior. Por isso lemos o corpo VIVO com pg_get_functiondef(),
-- trocamos apenas as âncoras e reexecutamos: se uma âncora não existir, a
-- migration falha com exceção em vez de sobrescrever.
-- =============================================================================

BEGIN;

DO $migration$
DECLARE
  v_oid  oid;
  v_def  text;
  v_novo text;
BEGIN
  -- ───────────────────────────────────────────────────────────────────────────
  -- 1) Varredura: ganha p_storage_path (NULL = comportamento atual, completo)
  -- ───────────────────────────────────────────────────────────────────────────
  SELECT p.oid INTO v_oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'qa_reabrir_exigencias_documento_invalido'
     AND p.pronargs = 0;

  IF v_oid IS NULL THEN
    RAISE EXCEPTION
      'qa_reabrir_exigencias_documento_invalido() sem argumentos não existe — '
      'ou a correção já foi aplicada, ou a função foi removida. Confira antes de reexecutar.';
  END IF;

  v_def := pg_get_functiondef(v_oid);

  IF position('qa_reabrir_exigencias_documento_invalido()' in v_def) = 0 THEN
    RAISE EXCEPTION 'Âncora da assinatura não encontrada no corpo vivo da função.';
  END IF;
  IF position('AND pd.status <> ''pendente''' in v_def) = 0 THEN
    RAISE EXCEPTION 'Âncora do filtro (pd.status <> ''pendente'') não encontrada no corpo vivo da função.';
  END IF;

  v_novo := replace(
    v_def,
    'qa_reabrir_exigencias_documento_invalido()',
    'qa_reabrir_exigencias_documento_invalido(p_storage_path text DEFAULT NULL)'
  );

  v_novo := replace(
    v_novo,
    'AND pd.status <> ''pendente''',
    'AND pd.status <> ''pendente''' || E'\n' ||
    '       -- Escopo do disparo: NULL = varredura completa (ciclo diário);' || E'\n' ||
    '       -- preenchido = só a exigência sustentada por este arquivo.' || E'\n' ||
    '       AND (p_storage_path IS NULL OR dc.arquivo_storage_path = p_storage_path)'
  );

  -- Dropar ANTES de criar: com as duas versões no ar, qualquer chamada sem
  -- argumento vira ambiguidade (42725) — inclusive a do ciclo diário.
  DROP FUNCTION public.qa_reabrir_exigencias_documento_invalido();
  EXECUTE v_novo;

  -- Assinatura nova nasce com EXECUTE para PUBLIC por padrão do Postgres.
  REVOKE ALL ON FUNCTION public.qa_reabrir_exigencias_documento_invalido(text)
    FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.qa_reabrir_exigencias_documento_invalido(text)
    TO service_role;

  -- ───────────────────────────────────────────────────────────────────────────
  -- 2) Trigger: passa o arquivo da linha que mudou, e só quando existe arquivo
  -- ───────────────────────────────────────────────────────────────────────────
  SELECT p.oid INTO v_oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'qa_doc_invalidado_reabre_exigencia';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'qa_doc_invalidado_reabre_exigencia() não encontrada.';
  END IF;

  v_def := pg_get_functiondef(v_oid);

  IF position('PERFORM public.qa_reabrir_exigencias_documento_invalido();' in v_def) = 0 THEN
    RAISE EXCEPTION
      'Âncora da chamada não encontrada no corpo vivo de qa_doc_invalidado_reabre_exigencia() — '
      'o corpo em produção mudou. Reveja o patch antes de aplicar.';
  END IF;

  v_novo := replace(
    v_def,
    'PERFORM public.qa_reabrir_exigencias_documento_invalido();',
    'IF nullif(OLD.arquivo_storage_path, '''') IS NOT NULL THEN' || E'\n' ||
    '      PERFORM public.qa_reabrir_exigencias_documento_invalido(OLD.arquivo_storage_path);' || E'\n' ||
    '    END IF;'
  );

  EXECUTE v_novo;
END
$migration$;

COMMIT;

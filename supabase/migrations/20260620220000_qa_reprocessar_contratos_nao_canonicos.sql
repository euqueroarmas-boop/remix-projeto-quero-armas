-- Reprocessa todo qa_contracts cujo conteudo_renderizado NÃO está na versão
-- vigente do template canônico (CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS).
--
-- Reaproveita a edge function qa-generate-contract (já corrigida para
-- reconstruir o snapshot quando template_versao diverge — ver commit
-- "fix: reprocessar conteúdo de contratos existentes quando o template
-- vigente muda") em vez de duplicar a lógica de filtro de anexos em SQL.
--
-- Idempotente: contratos já canônicos são ignorados pela própria edge
-- function (hasCanonicalTemplate) e não geram nenhuma alteração.
DO $$
DECLARE
  v_function_url text := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/qa-generate-contract';
  v_anon_key text := current_setting('app.settings.anon_key', true);
  v_service_key text;
  v_auth_key text;
  v_versao_vigente integer;
  v_row record;
  v_total integer := 0;
BEGIN
  -- service role armazenado no Vault (se disponível); fallback usa anon_key
  -- de configuração do projeto. Nenhuma credencial fica hardcoded no SQL.
  BEGIN
    SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;
  v_auth_key := COALESCE(v_service_key, v_anon_key, '');

  SELECT versao INTO v_versao_vigente
    FROM public.qa_contract_templates
   WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
     AND vigente = true
   LIMIT 1;

  IF v_versao_vigente IS NULL THEN
    RAISE NOTICE 'qa_reprocessar_contratos_nao_canonicos: nenhum template vigente encontrado, abortando.';
    RETURN;
  END IF;

  FOR v_row IN
    SELECT id, venda_id, template_codigo, template_versao
      FROM public.qa_contracts
     WHERE venda_id IS NOT NULL
       AND (
         template_codigo IS DISTINCT FROM 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
         OR template_versao IS DISTINCT FROM v_versao_vigente
         OR conteudo_renderizado IS NULL
         OR btrim(conteudo_renderizado) = ''
       )
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_auth_key,
          'apikey', v_auth_key,
          'x-trigger-source', 'qa_reprocessar_contratos_nao_canonicos'
        ),
        body := jsonb_build_object(
          'venda_id', v_row.venda_id,
          'force', true
        )
      );
      v_total := v_total + 1;
      RAISE NOTICE 'Reprocessando contrato % (venda %, template_versao % -> %)',
        v_row.id, v_row.venda_id, v_row.template_versao, v_versao_vigente;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao enfileirar reprocessamento do contrato % (venda %): %',
        v_row.id, v_row.venda_id, SQLERRM;
    END;
    PERFORM pg_sleep(0.2);
  END LOOP;

  RAISE NOTICE 'qa_reprocessar_contratos_nao_canonicos: % contrato(s) enfileirado(s) para reprocessamento.', v_total;
END;
$$;

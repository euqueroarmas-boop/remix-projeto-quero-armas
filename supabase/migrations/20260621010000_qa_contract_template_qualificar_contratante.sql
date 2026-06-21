-- A cláusula CONTRATANTE nunca usou as variáveis {{cliente_nome}},
-- {{cliente_cpf_cnpj}}, {{cliente_endereco}} e {{cliente_email}} — desde a
-- criação do template ela é um texto genérico que só remete ao site,
-- sem qualificar de fato a pessoa contratante com os dados do cadastro
-- (defeito de origem, não regressão).
--
-- Substitui pelo texto que efetivamente qualifica o CONTRATANTE com os
-- dados informados no cadastro, preservando a âncora jurídica ao aceite
-- eletrônico registrado pela plataforma.
--
-- IMPORTANTE: incrementa `versao`. As migrations anteriores de conteúdo
-- (base jurídica, decreto inexistente, anexo CAC) atualizaram corpo_html
-- SEM bumpar versao — isso significa que qa-generate-contract (que decide
-- se reprocessa um contrato existente comparando template_versao) nunca
-- detectou essas mudanças de conteúdo em contratos já emitidos, só em
-- contratos com template_codigo/versao NULL. A partir desta migration,
-- toda alteração de corpo_html deve sempre incrementar versao.
UPDATE public.qa_contract_templates
   SET versao = versao + 1,
       corpo_html = replace(
         corpo_html,
         '<p>Pessoa física ou jurídica identificada e qualificada conforme dados informados no momento da contratação por meio do sítio eletrônico https://www.euqueroarmas.com.br, cujos elementos integram este instrumento e são parte indissociável do aceite eletrônico registrado pela plataforma, doravante denominada simplesmente CONTRATANTE.</p>',
         '<p>{{cliente_nome}}, portador(a) do CPF/CNPJ nº {{cliente_cpf_cnpj}}, residente e domiciliado(a) em {{cliente_endereco}}, endereço eletrônico {{cliente_email}}, pessoa física ou jurídica identificada e qualificada conforme dados informados no momento da contratação por meio do sítio eletrônico https://www.euqueroarmas.com.br, cujos elementos integram este instrumento e são parte indissociável do aceite eletrônico registrado pela plataforma, doravante denominada simplesmente CONTRATANTE.</p>'
       ),
       updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   -- Idempotente: após a primeira aplicação o parágrafo passa a começar com
   -- "{{cliente_nome}}, portador..." (P minúsculo em "pessoa"), então a busca
   -- pelo texto original com "Pessoa" maiúsculo não casa mais.
   AND corpo_html LIKE '%<p>Pessoa física ou jurídica identificada e qualificada conforme dados informados no momento da contratação%';

-- Reprocessa automaticamente todo contrato existente que ficou com
-- template_versao desatualizada por causa do bump acima (mesmo mecanismo de
-- supabase/migrations/20260620220000_qa_reprocessar_contratos_nao_canonicos.sql).
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
    RAISE NOTICE 'qa_contract_template_qualificar_contratante: nenhum template vigente encontrado, abortando reprocessamento.';
    RETURN;
  END IF;

  FOR v_row IN
    SELECT id, venda_id, template_versao
      FROM public.qa_contracts
     WHERE venda_id IS NOT NULL
       AND arquivado_em IS NULL
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
          'x-trigger-source', 'qa_contract_template_qualificar_contratante'
        ),
        body := jsonb_build_object('venda_id', v_row.venda_id, 'force', true)
      );
      v_total := v_total + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao enfileirar reprocessamento do contrato % (venda %): %',
        v_row.id, v_row.venda_id, SQLERRM;
    END;
    PERFORM pg_sleep(0.2);
  END LOOP;

  RAISE NOTICE 'qa_contract_template_qualificar_contratante: % contrato(s) enfileirado(s) para reprocessamento.', v_total;
END;
$$;

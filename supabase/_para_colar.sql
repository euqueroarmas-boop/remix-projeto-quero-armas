-- ============================================================================
-- DIAGNÓSTICO — adjudicar os 12 apontamentos de segurança do Lovable
-- (2026-08-19). Só leitura: nenhum dado é alterado. Pode rodar quantas
-- vezes quiser. Uma única consulta → um único grid de resultado.
--
-- Seções do resultado (coluna "secao"):
--   1_policies_tabelas_suspeitas   → todas as policies vivas das tabelas que
--                                    batem com os apontamentos (consentimentos,
--                                    casos, exames, identidades funcionais,
--                                    psicólogos não localizados, revisões de
--                                    peças, assinaturas, customers)
--   2_policies_true_no_banco_inteiro → qualquer policy USING(true)/CHECK(true)
--                                    para anon/authenticated/public no banco todo
--   3_rls_desligado                → tabelas do schema public sem RLS
--   4_secdef_que_anon_executa      → funções SECURITY DEFINER executáveis por anon
--   5_secdef_so_logado_executa     → SECURITY DEFINER executáveis só por logado
--   6_secdef_sem_search_path_fixo  → SECURITY DEFINER sem search_path fixo
--   7_grants_e_rls_tabelas_suspeitas → GRANTs de anon/authenticated + RLS +
--                                    volume aproximado das tabelas suspeitas
--                                    (linhas_aprox=0 pode ser tabela nunca analisada)
-- ============================================================================
WITH alvo(tabela) AS (
  VALUES ('qa_cliente_ciencias'),
         ('qa_contract_aceites_log'),
         ('qa_arma_gt_declaracoes'),
         ('qa_declaracoes_residencia'),
         ('qa_casos'),
         ('qa_efetiva_necessidade'),
         ('qa_efetiva_necessidade_provas'),
         ('qa_efetiva_necessidade_acrescimos'),
         ('qa_efetiva_teses'),
         ('qa_exames_cliente'),
         ('qa_exames_alertas_enviados'),
         ('qa_identidades_funcionais'),
         ('qa_psico_nao_localizados'),
         ('qa_revisoes_pecas'),
         ('qa_geracoes_pecas'),
         ('contract_signatures'),
         ('qa_contract_signatures'),
         ('signature_logs'),
         ('customers'),
         ('lp_contract_acceptances')
)
SELECT '1_policies_tabelas_suspeitas' AS secao,
       p.tablename::text AS item,
       p.policyname::text || ' | cmd=' || p.cmd || ' | roles=' || array_to_string(p.roles, ',') AS detalhe,
       coalesce(p.qual, '(sem USING)') AS using_expr,
       coalesce(p.with_check, '(sem WITH CHECK)') AS with_check_expr
FROM pg_policies p
JOIN alvo a ON a.tabela = p.tablename
WHERE p.schemaname = 'public'

UNION ALL

SELECT '2_policies_true_no_banco_inteiro',
       p.tablename::text,
       p.policyname::text || ' | cmd=' || p.cmd || ' | roles=' || array_to_string(p.roles, ','),
       coalesce(p.qual, '(sem USING)'),
       coalesce(p.with_check, '(sem WITH CHECK)')
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND (p.qual = 'true' OR p.with_check = 'true')
  AND p.roles && ARRAY['anon','authenticated','public']::name[]

UNION ALL

SELECT '3_rls_desligado',
       c.relname::text,
       'RLS DESABILITADO',
       '-',
       '-'
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity

UNION ALL

SELECT '4_secdef_que_anon_executa',
       CASE WHEN p.provolatile = 'v' THEN 'mutantes' ELSE 'somente_leitura' END,
       count(*)::text || ' funcoes',
       string_agg(p.proname, ', ' ORDER BY p.proname),
       '-'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  AND pg_get_function_result(p.oid) <> 'trigger'
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
GROUP BY CASE WHEN p.provolatile = 'v' THEN 'mutantes' ELSE 'somente_leitura' END

UNION ALL

SELECT '5_secdef_so_logado_executa',
       CASE WHEN p.provolatile = 'v' THEN 'mutantes' ELSE 'somente_leitura' END,
       count(*)::text || ' funcoes',
       string_agg(p.proname, ', ' ORDER BY p.proname),
       '-'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  AND pg_get_function_result(p.oid) <> 'trigger'
  AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
GROUP BY CASE WHEN p.provolatile = 'v' THEN 'mutantes' ELSE 'somente_leitura' END

UNION ALL

SELECT '6_secdef_sem_search_path_fixo',
       'search_path_mutavel',
       count(*)::text || ' funcoes',
       coalesce(string_agg(p.proname, ', ' ORDER BY p.proname), '(nenhuma)'),
       '-'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  AND (p.proconfig IS NULL
       OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'))

UNION ALL

SELECT '7_grants_e_rls_tabelas_suspeitas',
       c.relname::text,
       'anon[sel=' || has_table_privilege('anon', c.oid, 'SELECT')::text
         || ' ins=' || has_table_privilege('anon', c.oid, 'INSERT')::text
         || ' upd=' || has_table_privilege('anon', c.oid, 'UPDATE')::text
         || ' del=' || has_table_privilege('anon', c.oid, 'DELETE')::text
         || '] auth[sel=' || has_table_privilege('authenticated', c.oid, 'SELECT')::text
         || ' ins=' || has_table_privilege('authenticated', c.oid, 'INSERT')::text
         || ' upd=' || has_table_privilege('authenticated', c.oid, 'UPDATE')::text
         || ' del=' || has_table_privilege('authenticated', c.oid, 'DELETE')::text || ']',
       CASE WHEN c.relrowsecurity THEN 'RLS ligado' ELSE 'RLS DESLIGADO' END,
       'linhas_aprox=' || greatest(c.reltuples, 0)::bigint::text
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN alvo a ON a.tabela = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r'

ORDER BY 1, 2, 3;

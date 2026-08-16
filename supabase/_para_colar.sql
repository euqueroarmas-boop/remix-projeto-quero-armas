-- ============================================================================
-- DIAGNÓSTICO ANTES DE MEXER EM RLS — leitura pura, não altera nada
-- ----------------------------------------------------------------------------
-- A migration que falta (20260701231000) REESCREVE as políticas de dono de
-- qa_vendas, qa_itens_venda, qa_contracts, qa_processos, qa_processo_documentos
-- e qa_processo_eventos. Se as políticas que existem hoje já funcionam, aplicar
-- por cima pode tirar do cliente o acesso aos próprios dados — e o sintoma seria
-- o portal ficar vazio para todo mundo.
--
-- Os 60 clientes ativos hoje enxergam os processos deles, então alguma coisa já
-- está certa aí. Preciso ver O QUÊ antes de trocar.
--
-- Rode e me mande o CSV inteiro (é uma consulta só, exporta tudo de uma vez).
-- ============================================================================

SELECT '1-funcoes' AS bloco,
       to_jsonb(t) AS dados
  FROM (
    SELECT p.proname                                 AS funcao,
           pg_get_function_identity_arguments(p.oid) AS argumentos,
           pg_get_function_result(p.oid)             AS retorno
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'qa_current_cliente_id',
         'qa_current_cliente_id_legado',
         'qa_is_active_staff'
       )
  ) t

UNION ALL
SELECT '2-politicas-do-cliente',
       to_jsonb(t)
  FROM (
    SELECT tablename   AS tabela,
           policyname  AS politica,
           cmd         AS operacao,
           roles::text AS papeis,
           qual        AS condicao
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN (
         'qa_vendas',
         'qa_itens_venda',
         'qa_contracts',
         'qa_processos',
         'qa_processo_documentos',
         'qa_processo_eventos'
       )
  ) t

ORDER BY 1;

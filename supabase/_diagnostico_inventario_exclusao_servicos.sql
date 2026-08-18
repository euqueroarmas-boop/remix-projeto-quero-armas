-- ============================================================================
-- DIAGNÓSTICO ÚNICO — antes de excluir os serviços de Eduardo e Wilker
-- ----------------------------------------------------------------------------
-- UM comando só. O editor do Lovable mostra apenas o resultado do último
-- comando de um lote, então tudo é normalizado em quatro colunas
-- (secao · item · detalhe · valor) e devolvido num único resultado.
--
-- Seções:
--   0 CLIENTE   → quem são, para conferir que os CPFs bateram
--   A INVENTARIO→ toda tabela do schema public com linha desses dois clientes,
--                 descoberta pelo catálogo (não por lista fixa, que já errou
--                 uma vez em qa_contracts.cliente_id)
--   B CHAVE     → o que pendura em processos, vendas, contratos, itens e
--                 efetiva necessidade, com a regra de ON DELETE
--   C GATILHO   → gatilhos de DELETE que podem barrar a exclusão
--
-- Somente leitura. Nada aqui altera dado.
-- ============================================================================

WITH alvo AS (
  SELECT array_agg(id)::bigint[] AS ids
    FROM public.qa_clientes
   WHERE regexp_replace(COALESCE(cpf,''), '\D', '', 'g')
         IN ('30164708880','01618065114')
),

clientes AS (
  SELECT '0 CLIENTE'::text          AS secao,
         nome_completo::text        AS item,
         ('id ' || id)::text        AS detalhe,
         COALESCE(cpf,'')::text     AS valor
    FROM public.qa_clientes
   WHERE regexp_replace(COALESCE(cpf,''), '\D', '', 'g')
         IN ('30164708880','01618065114')
),

inventario AS (
  SELECT 'A INVENTARIO'::text   AS secao,
         c.table_name::text     AS item,
         c.column_name::text    AS detalhe,
         (xpath(
            '/row/c/text()',
            query_to_xml(
              format('SELECT count(*) AS c FROM public.%I WHERE %I = ANY(%L::bigint[])',
                     c.table_name, c.column_name, (SELECT ids FROM alvo)),
              false, true, '')
          ))[1]::text           AS valor
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name   = c.table_name
   WHERE c.table_schema = 'public'
     AND t.table_type   = 'BASE TABLE'
     AND c.column_name IN ('cliente_id', 'qa_cliente_id')
     AND c.data_type   IN ('integer', 'bigint', 'smallint')
),

fks AS (
  SELECT 'B CHAVE'::text                                                AS secao,
         c.conrelid::regclass::text                                     AS item,
         (a.attname || ' -> ' || c.confrelid::regclass::text)::text      AS detalhe,
         (CASE c.confdeltype
            WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
            WHEN 'c' THEN 'CASCADE'   WHEN 'n' THEN 'SET NULL'
            WHEN 'd' THEN 'SET DEFAULT'
          END)::text                                                    AS valor
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
   WHERE c.contype = 'f'
     AND c.confrelid IN (
           'public.qa_processos'::regclass,
           'public.qa_vendas'::regclass,
           'public.qa_contracts'::regclass,
           'public.qa_itens_venda'::regclass,
           'public.qa_efetiva_necessidade'::regclass
         )
),

gatilhos AS (
  SELECT 'C GATILHO'::text AS secao,
         c.relname::text   AS item,
         t.tgname::text    AS detalhe,
         p.proname::text   AS valor
    FROM pg_trigger t
    JOIN pg_class c     ON c.oid = t.tgrelid
    JOIN pg_proc  p     ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE NOT t.tgisinternal
     AND n.nspname = 'public'
     AND (t.tgtype & 8) <> 0            -- dispara em DELETE
     AND c.relname IN (
       'qa_vendas','qa_itens_venda','qa_venda_eventos','qa_contracts',
       'qa_processos','qa_processo_documentos','qa_solicitacoes_servico',
       'qa_efetiva_necessidade','qa_clientes'
     )
)

SELECT secao, item, detalhe, valor
  FROM (
    SELECT * FROM clientes
    UNION ALL SELECT * FROM inventario WHERE valor <> '0'
    UNION ALL SELECT * FROM fks
    UNION ALL SELECT * FROM gatilhos
  ) z
 ORDER BY secao,
          CASE WHEN secao = 'A INVENTARIO' THEN lpad(valor, 9, '0') END DESC,
          item, detalhe;

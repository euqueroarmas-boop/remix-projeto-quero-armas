-- ============================================================================
-- INVENTÁRIO ANTES DE EXCLUIR OS SERVIÇOS — Eduardo Rizek Elias e Wilker
-- ----------------------------------------------------------------------------
-- Somente leitura. Nada aqui altera dado.
--
-- A primeira versão deste arquivo listava tabela por tabela, à mão, e quebrou
-- em `qa_contracts.qa_cliente_id` (a coluna real é `cliente_id`). Adivinhar
-- nome de coluna a partir do repositório não funciona neste projeto — o banco
-- é a fonte da verdade. Agora a consulta varre o próprio catálogo.
-- ============================================================================

-- ── (A0) OS DOIS CLIENTES ───────────────────────────────────────────────────
SELECT id, nome_completo, cpf, email, created_at
  FROM public.qa_clientes
 WHERE regexp_replace(COALESCE(cpf,''), '\D', '', 'g')
       IN ('30164708880','01618065114')
 ORDER BY nome_completo;


-- ── (A1) INVENTÁRIO AUTOMÁTICO ──────────────────────────────────────────────
-- Varre TODA tabela do schema public que tenha `cliente_id` ou `qa_cliente_id`
-- e conta as linhas dos dois clientes. Sem lista fixa: o que existir aparece.
WITH alvo AS (
  SELECT array_agg(id)::bigint[] AS ids
    FROM public.qa_clientes
   WHERE regexp_replace(COALESCE(cpf,''), '\D', '', 'g')
         IN ('30164708880','01618065114')
),
tabelas AS (
  SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name   = c.table_name
   WHERE c.table_schema = 'public'
     AND t.table_type   = 'BASE TABLE'
     AND c.column_name IN ('cliente_id', 'qa_cliente_id')
     AND c.data_type   IN ('integer', 'bigint', 'smallint')
),
contagem AS (
  SELECT t.table_name AS tabela,
         t.column_name AS coluna,
         (xpath(
            '/row/c/text()',
            query_to_xml(
              format('SELECT count(*) AS c FROM public.%I WHERE %I = ANY(%L::bigint[])',
                     t.table_name, t.column_name, (SELECT ids FROM alvo)),
              false, true, '')
          ))[1]::text::bigint AS linhas
    FROM tabelas t
)
SELECT tabela, coluna, linhas
  FROM contagem
 WHERE linhas > 0
 ORDER BY linhas DESC, tabela;


-- ── (B) MAPA REAL DE FKs QUE PENDURAM EM qa_processos E qa_vendas ───────────
-- `regra` = o que o banco faz com o filho quando o pai morre.
--   CASCADE   → some junto (não preciso listar no DELETE)
--   SET NULL  → fica órfão apontando para nada
--   NO ACTION / RESTRICT → o DELETE FALHA se eu não apagar o filho antes
SELECT c.confrelid::regclass::text AS tabela_pai,
       c.conrelid::regclass::text  AS tabela_filha,
       a.attname                   AS coluna_filha,
       CASE c.confdeltype
         WHEN 'a' THEN 'NO ACTION'
         WHEN 'r' THEN 'RESTRICT'
         WHEN 'c' THEN 'CASCADE'
         WHEN 'n' THEN 'SET NULL'
         WHEN 'd' THEN 'SET DEFAULT'
       END                         AS regra
  FROM pg_constraint c
  JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
 WHERE c.contype = 'f'
   AND c.confrelid IN ('public.qa_processos'::regclass, 'public.qa_vendas'::regclass)
 ORDER BY tabela_pai, regra, tabela_filha;

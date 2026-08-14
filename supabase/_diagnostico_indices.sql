-- =============================================================================
-- DIAGNOSTICO DE INDICES — somente leitura, nao altera nada
--
-- A analise do repositorio le apenas as migrations. Tudo que entrou no banco
-- "por fora" (pelo painel do Supabase) e invisivel para ela — e este projeto
-- ja tem caso documentado disso. Este bloco pergunta ao banco vivo.
--
-- Retorna 4 secoes num unico resultado:
--   1. FK SEM INDICE          -> join e DELETE do pai varrem a tabela filha
--   2. TABELA QUENTE SEQ SCAN -> muita leitura sequencial = indice faltando
--   3. INDICE NUNCA USADO     -> peso morto, custa em todo INSERT/UPDATE
--   4. INDICE DUPLICADO       -> mesma coluna lider repetida
-- =============================================================================

WITH fk_sem_indice AS (
  SELECT c.conrelid::regclass::text AS tabela,
         a.attname::text            AS alvo,
         c.conname::text            AS detalhe
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum   = c.conkey[1]
   WHERE c.contype = 'f'
     AND c.connamespace = 'public'::regnamespace
     AND NOT EXISTS (
       SELECT 1
         FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indkey[0] = c.conkey[1]
     )
),
tabela_quente AS (
  SELECT relname::text AS tabela,
         seq_scan::text AS alvo,
         (pg_size_pretty(pg_total_relation_size(relid))
           || ' / ' || n_live_tup::text || ' linhas')::text AS detalhe
    FROM pg_stat_user_tables
   WHERE schemaname = 'public'
     AND seq_scan > 500
     AND n_live_tup > 500
     AND seq_scan > COALESCE(idx_scan, 0)
),
indice_morto AS (
  SELECT s.relname::text AS tabela,
         s.indexrelname::text AS alvo,
         (pg_size_pretty(pg_relation_size(s.indexrelid))
           || ' / ' || s.idx_scan::text || ' usos')::text AS detalhe
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON i.indexrelid = s.indexrelid
   WHERE s.schemaname = 'public'
     AND s.idx_scan = 0
     AND NOT i.indisunique
     AND NOT i.indisprimary
     AND pg_relation_size(s.indexrelid) > 16384
),
indice_duplicado AS (
  SELECT t.tabela, t.alvo, t.detalhe
    FROM (
      SELECT i.indrelid::regclass::text AS tabela,
             a.attname::text            AS alvo,
             string_agg(c.relname, ', ' ORDER BY c.relname)::text AS detalhe,
             count(*) AS n
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum   = i.indkey[0]
       WHERE i.indrelid IN (
               SELECT oid FROM pg_class
                WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
             )
         AND i.indnatts = 1
       GROUP BY 1, 2
    ) t
   WHERE t.n > 1
)
SELECT '1. FK SEM INDICE'          AS secao, tabela, alvo, detalhe FROM fk_sem_indice
UNION ALL
SELECT '2. TABELA QUENTE SEQ SCAN' AS secao, tabela, alvo, detalhe FROM tabela_quente
UNION ALL
SELECT '3. INDICE NUNCA USADO'     AS secao, tabela, alvo, detalhe FROM indice_morto
UNION ALL
SELECT '4. INDICE DUPLICADO'       AS secao, tabela, alvo, detalhe FROM indice_duplicado
ORDER BY secao, tabela, alvo;

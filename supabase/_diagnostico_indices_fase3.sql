-- =============================================================================
-- FASE 3 — GERA o DDL de remocao das duplicatas. Somente leitura.
--
-- Nao apaga nada: MONTA o comando certo para cada par duplicado e devolve
-- como texto, pronto para conferir e colar.
--
-- Regra de qual sobrevive, nesta ordem:
--   1) o que sustenta uma CONSTRAINT (nao da para apagar como indice solto)
--   2) o UNIQUE (garante integridade, nao so velocidade)
--   3) o maior / nome alfabetico, como desempate
--
-- Quando os DOIS sustentam constraint (caso `id_legado`), a coluna `comando`
-- traz ALTER TABLE ... DROP CONSTRAINT, nao DROP INDEX — DROP INDEX falharia.
-- =============================================================================

WITH um_col AS (
  SELECT i.indexrelid,
         i.indrelid,
         i.indkey[0]     AS attnum,
         i.indisunique,
         c.relname::text AS idx_nome,
         pg_relation_size(i.indexrelid) AS bytes,
         (SELECT con.conname
            FROM pg_constraint con
           WHERE con.conindid = i.indexrelid
           LIMIT 1)::text AS constraint_nome
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
   WHERE i.indrelid IN (
           SELECT oid FROM pg_class
            WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
         )
     AND i.indnatts = 1
     AND i.indpred  IS NULL   -- indice parcial nao e duplicata
     AND i.indexprs IS NULL   -- indice de expressao tambem nao
),
ranked AS (
  SELECT u.*,
         a.attname::text AS coluna,
         u.indrelid::regclass::text AS tabela,
         count(*)      OVER (PARTITION BY u.indrelid, u.attnum) AS n,
         row_number()  OVER (PARTITION BY u.indrelid, u.attnum
                             ORDER BY (u.constraint_nome IS NOT NULL) DESC,
                                      u.indisunique DESC,
                                      u.bytes DESC,
                                      u.idx_nome) AS posicao
    FROM um_col u
    JOIN pg_attribute a ON a.attrelid = u.indrelid AND a.attnum = u.attnum
)
SELECT tabela,
       coluna,
       idx_nome AS remover,
       pg_size_pretty(bytes) AS tamanho,
       CASE
         WHEN constraint_nome IS NOT NULL
           THEN 'ALTER TABLE public.' || tabela || ' DROP CONSTRAINT ' || constraint_nome || ';'
         ELSE 'DROP INDEX IF EXISTS public.' || idx_nome || ';'
       END AS comando
  FROM ranked
 WHERE n > 1
   AND posicao > 1
 ORDER BY tabela, coluna;

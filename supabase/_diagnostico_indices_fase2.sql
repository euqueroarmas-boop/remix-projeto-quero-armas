-- =============================================================================
-- DIAGNOSTICO FASE 2 — somente leitura
--
-- Corrige um defeito do bloco anterior: a secao "INDICE DUPLICADO" nao excluia
-- indice PARCIAL. Dois indices na mesma coluna com clausulas WHERE diferentes
-- NAO sao duplicata — sao coisas distintas. A lista de 24 pares vinha inflada.
--
-- Tambem responde se `idx_scan = 0` e confiavel: se as estatisticas foram
-- zeradas ontem, "nunca usado" nao quer dizer nada.
-- =============================================================================

-- 1) Desde quando as estatisticas acumulam (contexto para "0 usos")
SELECT 'idade das estatisticas' AS secao,
       stats_reset::text        AS desde,
       (now() - stats_reset)::text AS ha_quanto_tempo
  FROM pg_stat_database
 WHERE datname = current_database()

UNION ALL

-- 2) Duplicata DE VERDADE: mesma coluna, ambos totais, mesmo tipo
SELECT 'duplicata real'::text,
       (i.indrelid::regclass::text || '.' || a.attname)::text,
       string_agg(c.relname, ' + ' ORDER BY c.relname)::text
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
 WHERE i.indrelid IN (SELECT oid FROM pg_class
                       WHERE relnamespace = 'public'::regnamespace AND relkind = 'r')
   AND i.indnatts = 1
   AND i.indpred IS NULL      -- <<< exclui indice parcial
   AND i.indexprs IS NULL     -- <<< exclui indice de expressao
 GROUP BY i.indrelid, a.attname
HAVING count(*) > 1;

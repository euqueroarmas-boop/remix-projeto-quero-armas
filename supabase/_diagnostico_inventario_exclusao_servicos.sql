-- ============================================================================
-- INVENTÁRIO ANTES DE EXCLUIR OS SERVIÇOS — Eduardo Rizek Elias e Wilker
-- ----------------------------------------------------------------------------
-- Somente leitura. Nada aqui altera dado.
--
-- (A) O que os dois clientes têm hoje, bloco a bloco.
-- (B) O mapa REAL de chaves estrangeiras que penduram em qa_processos e
--     qa_vendas, direto do catálogo do banco — o repositório não é fonte da
--     verdade deste projeto, e um DELETE montado a partir dele ou quebra no
--     meio ou deixa órfão.
-- ============================================================================

-- ── (A) INVENTÁRIO DOS DOIS CLIENTES ────────────────────────────────────────
WITH alvo AS (
  SELECT id, nome_completo, cpf
    FROM public.qa_clientes
   WHERE regexp_replace(COALESCE(cpf,''), '\D', '', 'g')
         IN ('30164708880','01618065114')
)
SELECT a.nome_completo, a.id AS cliente_id, x.bloco, x.qtd
  FROM alvo a
  CROSS JOIN LATERAL (
    VALUES
      ('01 vendas',              (SELECT count(*) FROM public.qa_vendas               v WHERE v.cliente_id = a.id)),
      ('02 itens de venda',      (SELECT count(*) FROM public.qa_itens_venda          i
                                    WHERE i.venda_id IN (SELECT COALESCE(v.id_legado, v.id) FROM public.qa_vendas v WHERE v.cliente_id = a.id))),
      ('03 processos',           (SELECT count(*) FROM public.qa_processos            p WHERE p.cliente_id = a.id)),
      ('04 processos SEM venda', (SELECT count(*) FROM public.qa_processos            p WHERE p.cliente_id = a.id AND p.venda_id IS NULL)),
      ('05 docs de processo',    (SELECT count(*) FROM public.qa_processo_documentos  d WHERE d.cliente_id = a.id)),
      ('06 solicitacoes',        (SELECT count(*) FROM public.qa_solicitacoes_servico s WHERE s.cliente_id = a.id)),
      ('07 contratos',           (SELECT count(*) FROM public.qa_contracts            c WHERE c.qa_cliente_id = a.id)),
      ('08 docs do Hub',         (SELECT count(*) FROM public.qa_documentos_cliente   h WHERE h.qa_cliente_id = a.id)),
      ('09 armas do arsenal',    (SELECT count(*) FROM public.qa_cliente_armas        w WHERE w.cliente_id = a.id)),
      ('10 CRAFs',               (SELECT count(*) FROM public.qa_crafs                r WHERE r.cliente_id = a.id)),
      ('11 GTEs',                (SELECT count(*) FROM public.qa_gtes                 g WHERE g.cliente_id = a.id)),
      ('12 CR',                  (SELECT count(*) FROM public.qa_cadastro_cr          k WHERE k.cliente_id = a.id)),
      ('13 exames',              (SELECT count(*) FROM public.qa_exames_cliente       e WHERE e.cliente_id = a.id)),
      ('14 efetiva necessidade', (SELECT count(*) FROM public.qa_efetiva_necessidade  n WHERE n.cliente_id = a.id))
  ) AS x(bloco, qtd)
 WHERE x.qtd > 0
 ORDER BY a.nome_completo, x.bloco;


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

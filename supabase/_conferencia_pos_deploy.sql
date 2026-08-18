-- ============================================================================
-- CONFERÊNCIA PÓS-DEPLOY — 18/08/2026, 13 funções publicadas 00:08 BRT
-- ----------------------------------------------------------------------------
-- UM comando só (o editor do Lovable mostra apenas o último resultado de um
-- lote). Quatro seções normalizadas em secao/item/detalhe/valor.
--
--   A PRAZO RECURSO  → processos que recorreram e ainda gerariam alarme falso
--   B JUNTADA        → juntadas já registradas pela função nova
--   C TESTE JUNTADA  → processos em que dá para testar MONTAR JUNTADA agora
--   D EXIGENCIA PF   → exigências da PF vivas hoje, para acompanhar a F8
--
-- Somente leitura.
-- ============================================================================

WITH prazo_recurso AS (
  SELECT 'A PRAZO RECURSO'::text                             AS secao,
         COALESCE(c.nome_completo, 'cliente ' || v.cliente_id)::text AS item,
         ('indef ' || COALESCE(iv.data_indeferimento::text, '—') ||
          ' · recurso ' || COALESCE(iv.data_recurso_administrativo::text, '—'))::text AS detalhe,
         (CASE
            WHEN iv.data_indeferimento_recurso IS NOT NULL THEN 'MS 120 DIAS (correto)'
            WHEN iv.data_recurso_administrativo >= COALESCE(iv.data_indeferimento, iv.data_notificacao)
              THEN 'PRAZO FECHADO (correto)'
            ELSE 'CONFERIR — recurso anterior ao evento'
          END)::text                                         AS valor
    FROM public.qa_itens_venda iv
    JOIN public.qa_vendas   v ON (v.id = iv.venda_id OR v.id_legado = iv.venda_id)
    LEFT JOIN public.qa_clientes c ON c.id = v.cliente_id
   WHERE iv.data_recurso_administrativo IS NOT NULL
),

juntadas AS (
  SELECT 'B JUNTADA'::text                                    AS secao,
         COALESCE(c.nome_completo, p.servico_nome, j.processo_id::text)::text AS item,
         ('v' || j.versao || ' · ' || j.paginas || ' pág · ' ||
          jsonb_array_length(j.itens_json) || ' docs · ' ||
          jsonb_array_length(j.ignorados_json) || ' fora')::text AS detalhe,
         to_char(j.montada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')::text AS valor
    FROM public.qa_processo_juntadas j
    LEFT JOIN public.qa_processos p ON p.id = j.processo_id
    LEFT JOIN public.qa_clientes  c ON c.id = j.cliente_id
),

candidatos AS (
  SELECT 'C TESTE JUNTADA'::text                              AS secao,
         COALESCE(c.nome_completo, 'cliente ' || p.cliente_id)::text AS item,
         COALESCE(p.servico_nome, '—')::text                  AS detalhe,
         (CASE WHEN EXISTS (SELECT 1 FROM public.qa_processo_juntadas j WHERE j.processo_id = p.id)
               THEN 'JA TEM JUNTADA'
               ELSE 'PODE TESTAR AQUI' END)::text             AS valor
    FROM public.qa_processos p
    LEFT JOIN public.qa_clientes c ON c.id = p.cliente_id
   WHERE p.status = 'pronto_para_protocolar'
),

exigencias_pf AS (
  SELECT 'D EXIGENCIA PF'::text                               AS secao,
         COALESCE(c.nome_completo, 'cliente ' || d.cliente_id)::text AS item,
         (COALESCE(d.nome_documento, d.tipo_documento) ||
          CASE WHEN d.regra_validacao ? 'reaberta_em' THEN ' (REABERTA)' ELSE '' END)::text AS detalhe,
         COALESCE(d.status, '—')::text                        AS valor
    FROM public.qa_processo_documentos d
    LEFT JOIN public.qa_clientes c ON c.id = d.cliente_id
   WHERE d.regra_validacao ->> 'origem' = 'manifestacao_pf'
      OR d.regra_validacao ->> 'grupo_checklist' = 'exigencias_pf'
)

SELECT secao, item, detalhe, valor
  FROM (
    SELECT * FROM prazo_recurso
    UNION ALL SELECT * FROM juntadas
    UNION ALL SELECT * FROM candidatos
    UNION ALL SELECT * FROM exigencias_pf
  ) z
 ORDER BY secao, item, detalhe;

-- ============================================================================
-- DIAGNÓSTICO — RODADA 2 — Concessão de CR (serviço 44, slug 'concessao-cr')
-- ----------------------------------------------------------------------------
-- SOMENTE LEITURA.
-- BLOCO A: rode e exporte (5 linhas em JSON).
-- BLOCO B: rode SEPARADO e exporte num CSV próprio (é o texto da IN 311).
-- ============================================================================

-- ─────────────────────────── BLOCO A ───────────────────────────
SELECT 'R1 mapa servicos' AS bloco, (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT c.servico_id, c.slug, c.nome, c.ativo, c.categoria, c.tipo_processo,
           c.checklist_type, c.sigla_protocolo, c.preco,
           s.nome_servico AS nome_em_qa_servicos, s.valor_servico
      FROM public.qa_servicos_catalogo c
      LEFT JOIN public.qa_servicos s ON s.id = c.servico_id
     WHERE c.ativo
     ORDER BY c.servico_id NULLS LAST
  ) t) AS dados

UNION ALL SELECT 'R2 qa_servicos completo', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT id, nome_servico, valor_servico, is_combo FROM public.qa_servicos ORDER BY id
  ) t)

UNION ALL SELECT 'R3 checklist CR e RENOV-CR', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
           obrigatorio_etapa02, ativo, emissor, escopo, orgao_emissor, formato_aceito,
           validade_dias, condicao_modalidade, condicao_profissional, grupo_id,
           regra_validacao
      FROM public.qa_servicos_documentos
     WHERE servico_id IN (32, 44)
     ORDER BY servico_id, ordem, tipo_documento
  ) t)

UNION ALL SELECT 'R4 tipos_servicos CR', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT servico_id, tipo_documento, obrigatorio, ordem, modo_reaproveitamento,
           validade_dias, observacao_regra
      FROM public.qa_tipos_documento_servicos
     WHERE servico_id IN (32, 44)
     ORDER BY servico_id, ordem
  ) t)

UNION ALL SELECT 'R5 funcao etapa_documento', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT p.proname AS funcao, pg_get_functiondef(p.oid) AS definicao
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'qa_etapa_documento'
  ) t);


-- ─────────────────────────── BLOCO B (rodar sozinho) ───────────────────────────
-- Texto integral da IN 311/2025 fatiado em pedaços de 4.000 caracteres.
-- É a fonte da exigência do CR — sem ela eu montaria o checklist de cabeça,
-- o que a regra do projeto proíbe.
SELECT g.i AS parte,
       substr(f.texto_integral, (g.i - 1) * 4000 + 1, 4000) AS texto
  FROM public.qa_fontes_normativas f
  CROSS JOIN LATERAL generate_series(1, ceil(length(f.texto_integral) / 4000.0)::int) AS g(i)
 WHERE f.id = '86273684-2937-4855-aa33-70c0f76f1b2a'
 ORDER BY g.i;

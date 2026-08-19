-- ============================================================================
-- ANTES DE MEXER NO CATÁLOGO — as duas colunas que faltaram na consulta passada
--
-- A consulta anterior mostrou o catálogo da CONCESSÃO DE CR com a MESMA
-- certidão aparecendo duas vezes e com prazos diferentes (30 e 90 dias). Isso
-- não deveria ser possível: existe índice único em
-- (servico_id, tipo_documento, condicao_profissional).
--
-- Só há duas explicações, e elas pedem conserto diferente:
--   • O filtro `nome_servico ILIKE '%CONCESS%CR%'` casou MAIS DE UM serviço —
--     ou seja, existem dois catálogos de CR convivendo.
--   • São a mesma linha em condições profissionais diferentes, e eu não pedi
--     a coluna para ver.
--
-- Foi por não olhar a condição profissional que a primeira conferência de
-- ordem, em 20/08, acusou duas divergências que não existiam. Não repito.
--
--   A) Quais SERVIÇOS casam com "CR" — id, nome e quantas exigências têm.
--   B) Onde o MESMO documento tem mais de um prazo dentro do mesmo serviço.
--   C) Prazo faltando no catálogo, agora COM serviço e condição à vista.
-- ============================================================================

SELECT 'A · SERVIÇOS QUE CASAM COM CR' AS bloco,
       1 AS ord,
       s.nome_servico AS origem,
       jsonb_build_object(
         'servico_id',   s.id,
         'valor',        s.valor_servico,
         'exigencias_ativas',
           (SELECT count(*) FROM public.qa_servicos_documentos x
             WHERE x.servico_id = s.id AND x.ativo = true),
         'processos_abertos',
           (SELECT count(*) FROM public.qa_processos p
             WHERE p.servico_id = s.id
               AND p.status NOT IN ('concluido', 'cancelado', 'excluido_lgpd'))
       ) AS dados
  FROM public.qa_servicos s
 WHERE s.nome_servico ILIKE '%CR%'

UNION ALL

SELECT 'B · MESMO DOCUMENTO COM DOIS PRAZOS NO MESMO SERVIÇO' AS bloco,
       2 AS ord,
       s.nome_servico || ' · ' || d.tipo_documento AS origem,
       jsonb_build_object(
         'servico_id',   s.id,
         'quantas_linhas', d.linhas,
         'prazos',       d.prazos,
         'condicoes',    d.condicoes,
         'ordens',       d.ordens,
         'nomes',        d.nomes
       ) AS dados
  FROM (
    SELECT sd.servico_id,
           sd.tipo_documento,
           count(*)                                        AS linhas,
           array_agg(DISTINCT sd.validade_dias)             AS prazos,
           array_agg(DISTINCT coalesce(sd.condicao_profissional, '(geral)')) AS condicoes,
           array_agg(sd.ordem ORDER BY sd.ordem)            AS ordens,
           array_agg(DISTINCT sd.nome_documento)            AS nomes
      FROM public.qa_servicos_documentos sd
     WHERE sd.ativo = true
     GROUP BY sd.servico_id, sd.tipo_documento
    HAVING count(*) > 1
  ) d
  JOIN public.qa_servicos s ON s.id = d.servico_id

UNION ALL

SELECT 'C · PRAZO FALTANDO, COM SERVIÇO E CONDIÇÃO' AS bloco,
       3 AS ord,
       s.nome_servico || ' · ' || sd.nome_documento AS origem,
       jsonb_build_object(
         'servico_id',    s.id,
         'tipo',          sd.tipo_documento,
         'condicao_prof', coalesce(sd.condicao_profissional, '(geral)'),
         'ordem',         sd.ordem,
         'e_do_mes',      public.qa_documento_do_mes(sd.tipo_documento, sd.nome_documento),
         'prazo_em_outra_linha_do_mesmo_servico',
           (SELECT array_agg(DISTINCT x.validade_dias)
              FROM public.qa_servicos_documentos x
             WHERE x.servico_id = sd.servico_id
               AND x.tipo_documento = sd.tipo_documento
               AND x.ativo = true
               AND x.validade_dias IS NOT NULL),
         'prazo_usado_em_outros_servicos',
           (SELECT array_agg(DISTINCT y.validade_dias)
              FROM public.qa_servicos_documentos y
             WHERE y.tipo_documento = sd.tipo_documento
               AND y.ativo = true
               AND y.validade_dias IS NOT NULL)
       ) AS dados
  FROM public.qa_servicos_documentos sd
  JOIN public.qa_servicos s ON s.id = sd.servico_id
 WHERE sd.ativo = true
   AND sd.validade_dias IS NULL
   AND (
     public.qa_documento_do_mes(sd.tipo_documento, sd.nome_documento)
     OR lower(sd.tipo_documento) LIKE '%antecedentes%'
     OR lower(sd.tipo_documento) LIKE 'certidao%'
     OR lower(sd.tipo_documento) IN ('renda_cartao_cnpj', 'renda_qsa')
     OR lower(sd.tipo_documento) LIKE 'comprovante_residencia%'
   )

 ORDER BY ord, origem;

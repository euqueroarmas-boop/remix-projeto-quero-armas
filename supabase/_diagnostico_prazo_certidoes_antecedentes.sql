-- ============================================================================
-- QUAIS CERTIDÕES ESTÃO DIVERGINDO, E EM QUAIS SERVIÇOS
--
-- A pergunta do usuário: "há certidões que vencem em 30 — normalmente as que
-- não têm data de validade impressa — e há certidões que vencem em 90, e essas
-- trazem a data no próprio documento. Quais estão divergindo?"
--
-- Esta consulta responde certidão por certidão, sem agregar nada por cima:
--
--   A) UM QUADRO POR TIPO DE CERTIDÃO. Quais prazos existem hoje, em quantos
--      serviços cada prazo aparece, e quantos serviços estão sem prazo.
--      A coluna `divergente` diz se o tipo tem mais de um número em uso.
--
--   B) A LINHA A LINHA, para os tipos divergentes. Serviço por serviço, com
--      o prazo e o nome exato — é aqui que se vê se o 30 e o 90 estão no
--      mesmo documento ou em documentos que só têm o nome parecido.
--
--   C) O QUE O ACERVO DIZ NA PRÁTICA. Para cada tipo, quantos arquivos reais
--      trouxeram data de emissão e data de validade, e a distância média
--      entre elas. É a evidência de qual certidão traz validade impressa:
--      onde `arquivos_com_validade_propria` for alto, o documento diz o
--      próprio prazo; onde for zero, o prazo é convenção nossa.
-- ============================================================================

SELECT 'A · QUADRO POR TIPO DE CERTIDÃO' AS bloco,
       1 AS ord,
       q.tipo_documento AS origem,
       jsonb_build_object(
         'prazos_em_uso',        q.prazos,
         'servicos_com_prazo',   q.com_prazo,
         'servicos_sem_prazo',   q.sem_prazo,
         'divergente',           (array_length(q.prazos, 1) > 1)
       ) AS dados
  FROM (
    SELECT sd.tipo_documento,
           array_agg(DISTINCT sd.validade_dias)
             FILTER (WHERE sd.validade_dias IS NOT NULL) AS prazos,
           count(*) FILTER (WHERE sd.validade_dias IS NOT NULL) AS com_prazo,
           count(*) FILTER (WHERE sd.validade_dias IS NULL)     AS sem_prazo
      FROM public.qa_servicos_documentos sd
     WHERE sd.ativo = true
       AND (lower(sd.tipo_documento) LIKE '%antecedentes%'
            OR lower(sd.tipo_documento) LIKE 'certidao%')
     GROUP BY sd.tipo_documento
  ) q

UNION ALL

SELECT 'B · LINHA A LINHA DOS TIPOS DIVERGENTES' AS bloco,
       2 AS ord,
       sd.tipo_documento || ' · ' || s.nome_servico AS origem,
       jsonb_build_object(
         'servico_id',    s.id,
         'prazo_dias',    sd.validade_dias,
         'nome_documento', sd.nome_documento,
         'condicao_prof', coalesce(sd.condicao_profissional, '(geral)'),
         'ordem',         sd.ordem,
         'processos_abertos_do_servico',
           (SELECT count(*) FROM public.qa_processos p
             WHERE p.servico_id = s.id
               AND p.status NOT IN ('concluido', 'cancelado', 'excluido_lgpd'))
       ) AS dados
  FROM public.qa_servicos_documentos sd
  JOIN public.qa_servicos s ON s.id = sd.servico_id
 WHERE sd.ativo = true
   AND (lower(sd.tipo_documento) LIKE '%antecedentes%'
        OR lower(sd.tipo_documento) LIKE 'certidao%')
   AND sd.tipo_documento IN (
     SELECT x.tipo_documento
       FROM public.qa_servicos_documentos x
      WHERE x.ativo = true
        AND (lower(x.tipo_documento) LIKE '%antecedentes%'
             OR lower(x.tipo_documento) LIKE 'certidao%')
      GROUP BY x.tipo_documento
     HAVING count(DISTINCT x.validade_dias) FILTER (WHERE x.validade_dias IS NOT NULL) > 1
         OR count(*) FILTER (WHERE x.validade_dias IS NULL) > 0
   )

UNION ALL

SELECT 'C · O QUE OS ARQUIVOS REAIS DIZEM' AS bloco,
       3 AS ord,
       dc.tipo_documento AS origem,
       jsonb_build_object(
         'arquivos',                     count(*),
         'com_data_emissao',             count(dc.data_emissao),
         'arquivos_com_validade_propria',
           count(*) FILTER (WHERE dc.data_emissao IS NOT NULL
                              AND dc.data_validade IS NOT NULL),
         'dias_entre_emissao_e_validade',
           array_agg(DISTINCT (dc.data_validade - dc.data_emissao))
             FILTER (WHERE dc.data_emissao IS NOT NULL
                       AND dc.data_validade IS NOT NULL)
       ) AS dados
  FROM public.qa_documentos_cliente dc
 WHERE lower(dc.tipo_documento) LIKE '%antecedentes%'
    OR lower(dc.tipo_documento) LIKE 'certidao%'
 GROUP BY dc.tipo_documento

 ORDER BY ord, origem;

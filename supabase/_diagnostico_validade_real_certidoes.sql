-- ============================================================================
-- A VALIDADE REAL DAS CERTIDÕES, ARQUIVO POR ARQUIVO
--
-- Três fontes de verdade convivem hoje, e é a discordância entre elas que
-- produz o 30/60/90 do catálogo:
--
--   1. O PRÓPRIO DOCUMENTO. Três parsers leem o prazo escrito no PDF:
--        • STM  — /valida por (\d+) dias/
--        • TRF  — /no prazo de (\d+) \(/     ← vale para SJSP/JEF e TRF3
--        • TJM  — /PRAZO DE (\d+) \(/
--      O valor lido fica em `ia_dados_extraidos.camposExtraidos.validade_dias`.
--      Os demais órgãos (SSP, TJSP distribuições, TJSP execuções, TSE) NÃO
--      têm essa leitura — o prazo deles é convenção nossa.
--
--   2. A REGRA DO HUB (`calcularValidadeHubPorTipo`), que grava
--      `data_validade` no acervo. Ela roda ANTES do valor lido do PDF e ganha
--      dele — ou seja, onde a regra tem opinião, o que está impresso no
--      documento é descartado.
--
--   3. O CATÁLOGO (`qa_servicos_documentos.validade_dias`), usado para montar
--      o checklist do processo.
--
-- Esta consulta põe as três lado a lado para cada arquivo real do acervo.
-- A coluna `conflito` marca onde o documento diz um prazo e o sistema gravou
-- outro — é ali que está a decisão a tomar.
-- ============================================================================

SELECT c.nome_completo,
       dc.tipo_documento,
       dc.arquivo_nome,
       dc.data_emissao,
       dc.data_validade,
       (dc.data_validade - dc.data_emissao)               AS dias_gravados,
       (dc.ia_dados_extraidos #>> '{camposExtraidos,validade_dias}') AS dias_lidos_do_pdf,
       CASE
         WHEN dc.ia_dados_extraidos #>> '{camposExtraidos,validade_dias}' IS NULL
           THEN 'o documento não declara prazo'
         WHEN dc.data_emissao IS NULL OR dc.data_validade IS NULL
           THEN 'faltam datas para comparar'
         WHEN (dc.data_validade - dc.data_emissao)
              = (dc.ia_dados_extraidos #>> '{camposExtraidos,validade_dias}')::int
           THEN 'confere'
         ELSE 'CONFLITO — o PDF diz um prazo e o sistema gravou outro'
       END                                                AS conflito,
       dc.status,
       dc.created_at
  FROM public.qa_documentos_cliente dc
  JOIN public.qa_clientes c ON c.id = dc.qa_cliente_id
 WHERE lower(dc.tipo_documento) LIKE '%antecedentes%'
    OR lower(dc.tipo_documento) LIKE 'certidao%'
 ORDER BY dc.tipo_documento, c.nome_completo, dc.created_at;

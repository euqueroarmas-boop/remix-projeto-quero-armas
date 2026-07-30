-- Preenche data_emissao e data_validade dos documentos que já estão no Hub.
--
-- A correção que fez a Central de Adesão gravar essas datas vale só para
-- documentos NOVOS. Os que já estavam salvos continuaram "SEM DATA" — é o caso
-- do comprovante de residência, do cartão CNPJ e do QSA do cliente Gilson.
-- Sem data de emissão não há validade, e sem validade o alerta de vencimento
-- nunca dispara e a exigência do processo não sabe se o documento ainda vale.
--
-- A data já existe: a IA a extraiu na classificação e ela está gravada em
-- ia_dados_extraidos. Só nunca foi promovida para a coluna.

BEGIN;

-- 1) data_emissao a partir do que a IA extraiu.
--    Dois formatos coexistem: camposExtraidos (Hub) e campos_extraidos (Central).
UPDATE public.qa_documentos_cliente
SET data_emissao = COALESCE(
      NULLIF(ia_dados_extraidos->'camposExtraidos'->>'data_emissao', ''),
      NULLIF(ia_dados_extraidos->'campos_extraidos'->>'data_emissao', '')
    )::date
WHERE data_emissao IS NULL
  AND status <> 'excluido'
  AND COALESCE(
        NULLIF(ia_dados_extraidos->'camposExtraidos'->>'data_emissao', ''),
        NULLIF(ia_dados_extraidos->'campos_extraidos'->>'data_emissao', '')
      ) ~ '^\d{4}-\d{2}-\d{2}$';

-- 2) QSA herda a emissão do cartão CNPJ do mesmo cliente, já que é emitido
--    junto e não traz data própria. Usa o cartão mais recente.
UPDATE public.qa_documentos_cliente q
SET data_emissao = c.data_emissao
FROM (
  SELECT DISTINCT ON (qa_cliente_id) qa_cliente_id, data_emissao
  FROM public.qa_documentos_cliente
  WHERE tipo_documento IN ('renda_cartao_cnpj','renda_cnpj_autonomo','renda_ccmei')
    AND data_emissao IS NOT NULL AND status <> 'excluido'
  ORDER BY qa_cliente_id, data_emissao DESC
) c
WHERE q.tipo_documento = 'renda_qsa'
  AND q.data_emissao IS NULL
  AND q.status <> 'excluido'
  AND q.qa_cliente_id = c.qa_cliente_id;

-- 3) Validade calculada pela regra de cada tipo — as mesmas do front
--    (calcularValidadeEfetiva), aplicadas aqui sobre o acervo já existente.
UPDATE public.qa_documentos_cliente
SET data_validade = CASE
  -- Empresa (cartão CNPJ, CCMEI, QSA): 30 dias
  WHEN tipo_documento IN ('renda_cartao_cnpj','renda_cnpj_autonomo','renda_ccmei','renda_qsa')
    THEN data_emissao + INTERVAL '30 days'
  -- Certidões de 90 dias
  WHEN tipo_documento IN ('antecedentes_federal_trf3_regional','antecedentes_militar')
    THEN data_emissao + INTERVAL '90 days'
  -- Identificação civil: 10 anos
  WHEN tipo_documento IN ('rg_com_cpf','cin','cnh')
    THEN data_emissao + INTERVAL '10 years'
  -- Procuração e filiação a clube: 12 meses
  WHEN tipo_documento IN ('procuracao','procuracao_assinada','comprovante_clube_tiro')
    THEN data_emissao + INTERVAL '12 months'
  -- Comprovante de residência e demais certidões: 1 mês
  WHEN tipo_documento = 'comprovante_residencia'
    OR tipo_documento LIKE 'antecedentes_%'
    THEN data_emissao + INTERVAL '1 month'
  ELSE NULL
END
WHERE data_validade IS NULL
  AND data_emissao IS NOT NULL
  AND status <> 'excluido';

COMMIT;

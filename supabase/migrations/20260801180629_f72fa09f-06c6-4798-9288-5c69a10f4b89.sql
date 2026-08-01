-- 1) Catálogo admin: matriz canônica de ocupação lícita por condição
WITH alvo AS (
  SELECT DISTINCT servico_id FROM public.qa_servicos_documentos
  WHERE tipo_documento = 'renda_definir_condicao'
),
matriz(condicao_profissional, tipo_documento, nome_documento, ordem) AS (
  VALUES
    ('autonomo','renda_ccmei','CCMEI — Certificado da Condição de Microempreendedor Individual',101),
    ('autonomo','renda_cartao_cnpj','Cartão CNPJ (emitido nos últimos 30 dias)',102),
    ('autonomo','renda_qsa','QSA — Quadro de Sócios e Administradores',103),
    ('autonomo','renda_nf_recente','Nota fiscal emitida para um cliente',104),
    ('empresario','renda_contrato_social','Contrato Social, Requerimento de Empresário ou Ficha Cadastral (Junta Comercial)',101),
    ('empresario','renda_cartao_cnpj','Cartão CNPJ (emitido nos últimos 30 dias)',102),
    ('empresario','renda_qsa','QSA — Quadro de Sócios e Administradores',103),
    ('empresario','renda_nf_empresa','Nota fiscal emitida pela empresa para um cliente',104)
)
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT a.servico_id, m.tipo_documento, m.nome_documento, 'complementar', true, m.ordem, true, m.condicao_profissional
FROM alvo a CROSS JOIN matriz m
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_servicos_documentos s
  WHERE s.servico_id = a.servico_id
    AND s.tipo_documento = m.tipo_documento
    AND s.condicao_profissional = m.condicao_profissional
);

-- Reativa/normaliza as linhas já existentes da matriz
UPDATE public.qa_servicos_documentos s
SET ativo = true, obrigatorio = true, updated_at = now()
WHERE s.condicao_profissional IN ('autonomo','empresario')
  AND s.tipo_documento IN ('renda_ccmei','renda_cartao_cnpj','renda_qsa','renda_nf_recente','renda_nf_empresa','renda_contrato_social');

-- Desativa entradas superadas (duplicam a matriz acima)
UPDATE public.qa_servicos_documentos
SET ativo = false, updated_at = now()
WHERE condicao_profissional IN ('autonomo','empresario')
  AND tipo_documento IN ('renda_cnpj_autonomo','renda_ficha_cadastral_jucesp');

-- 2) Conserta o processo do Gilson (ocupação lícita fechada vazia)
UPDATE public.qa_processos
SET condicao_profissional = 'autonomo'
WHERE id = 'afed6d03-cb26-450d-8bf1-488ff5155f99';

DELETE FROM public.qa_processo_documentos
WHERE processo_id = 'afed6d03-cb26-450d-8bf1-488ff5155f99'
  AND tipo_documento = 'renda_definir_condicao';

INSERT INTO public.qa_processo_documentos
  (processo_id, cliente_id, tipo_documento, nome_documento, etapa, status, obrigatorio, ordem,
   formato_aceito, regra_validacao, prazo_recomendado_dias, validade_dias)
SELECT 'afed6d03-cb26-450d-8bf1-488ff5155f99'::uuid, 214, v.tipo, v.nome, 'complementar', 'pendente', true, v.ordem,
       ARRAY['pdf','jpg','jpeg','png'],
       jsonb_build_object('exige', jsonb_build_array('razao_social')),
       v.prazo, v.prazo
FROM (VALUES
  ('renda_ccmei','CCMEI — Certificado da Condição de Microempreendedor Individual',101,NULL::int),
  ('renda_cartao_cnpj','Cartão CNPJ (emitido nos últimos 30 dias)',102,30),
  ('renda_qsa','QSA — Quadro de Sócios e Administradores',103,30),
  ('renda_nf_recente','Nota fiscal emitida para um cliente',104,NULL::int)
) AS v(tipo, nome, ordem, prazo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_processo_documentos d
  WHERE d.processo_id = 'afed6d03-cb26-450d-8bf1-488ff5155f99'
    AND d.tipo_documento = v.tipo
);

INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator, dados_json)
VALUES ('afed6d03-cb26-450d-8bf1-488ff5155f99','condicao_profissional_definida',
        'Correção administrativa: grupo de ocupação lícita reaberto para AUTÔNOMO/MEI (CCMEI, Cartão CNPJ, QSA, NF).',
        'sistema', jsonb_build_object('condicao','autonomo','origem','correcao_furo_ocupacao_licita'));
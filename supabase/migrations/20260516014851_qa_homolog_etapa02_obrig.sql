-- Log de homologação: ajuste da regra de obrigatoriedade na Etapa 02
UPDATE qa_homologacao_sessoes
SET etapa = 'etapa02_documentos_regra_obrigatoriedade_ajustada',
    payload = payload || '{"obrigatorios_universais": ["identidade", "comprovante_residencia"], "opcionais_etapa02_envio_pos_pagamento_arsenal": true, "regra_valida_para_18_servicos": true}'::jsonb,
    observacoes = observacoes || ' | Etapa 02: identidade + comprovante de residência são os únicos obrigatórios para avançar. Demais documentos visíveis com badge opcional. Checklist do Arsenal cobra os pendentes pós-pagamento.'
WHERE sessao_codigo = 'HOMOLOG_CATALOGO_COMPLETO_2026_05_15';

UPDATE qa_homologacao_sessoes
SET etapa = 'cadastro_refinado_jeito3_implementado_atras_feature_flag',
    payload = COALESCE(payload, '{}'::jsonb) || '{"feature_flag": "VITE_QA_CADASTRO_V2_ENABLED", "etapas_refinadas": 5, "padrao_visual": "editorial_serifado", "fluxo": "/cadastro com 5 etapas: confirmar servico -> documentos -> revisao -> pagamento -> conclusao", "regressao": "zero - fallback para QACadastroPublicoPage quando flag=false"}'::jsonb,
    observacoes = COALESCE(observacoes, '') || ' | /cadastro refinado implementado atras de feature flag VITE_QA_CADASTRO_V2_ENABLED. Bugs 1-3 preservados. Fluxo legado intacto via fallback.'
WHERE sessao_codigo = 'HOMOLOG_CATALOGO_COMPLETO_2026_05_15';
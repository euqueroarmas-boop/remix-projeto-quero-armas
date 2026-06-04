UPDATE qa_homologacao_sessoes
SET etapa = 'etapa00_integrada_visual_refinado_completo',
    payload = COALESCE(payload, '{}'::jsonb) || '{"caminho_escolhido": "clonagem_estrutural_visual_refinado", "constantes_centralizadas": true, "cadastro_v2_routes_redirect": true, "visual_paridade_etapas_01_05": true}'::jsonb,
    observacoes = COALESCE(observacoes, '') || ' | Etapa 00 integrada com visual 100% refinado igual as Etapas 01-05. Clonagem estrutural do catalogo v2 sem reaproveitar visual antigo. Cadastro-v2/* virou redirect.'
WHERE sessao_codigo = 'HOMOLOG_CATALOGO_COMPLETO_2026_05_15';
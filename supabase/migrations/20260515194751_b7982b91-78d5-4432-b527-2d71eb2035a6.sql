UPDATE public.qa_homologacao_sessoes
SET etapa = 'cadastro_v2_etapa2_implementada_opcao1',
    payload = COALESCE(payload, '{}'::jsonb) || '{"v2_etapa2_rotas": ["/cadastro-v2/defesa-pessoal", "/cadastro-v2/cac", "/cadastro-v2/profissao-ativa", "/cadastro-v2/aposentado", "/cadastro-v2/cursos"], "estrategia": "opcao_1_redireciona_para_cadastro_legado", "decidir_opcao_2_depois": true}'::jsonb,
    observacoes = COALESCE(observacoes, '') || ' | Etapa 2 implementada como Opcao 1 (v2 guia ate escolha do servico, /cadastro legado finaliza). Avaliar Opcao 2 apos validacao.'
WHERE sessao_codigo = 'HOMOLOG_CATALOGO_COMPLETO_2026_05_15';
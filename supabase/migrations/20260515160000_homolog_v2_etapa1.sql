-- Aditivo: registra a implementação da rota /cadastro-v2 (Etapa 1)
-- na sessão de homologação. Não altera schema.
UPDATE public.qa_homologacao_sessoes
SET etapa = 'cadastro_v2_etapa1_implementada',
    payload = COALESCE(payload, '{}'::jsonb) || '{"v2_rota": "/cadastro-v2", "v2_etapa1_perfis": ["defesa_pessoal","cac","profissional_ativo","aposentado_inativo","orientacao_necessaria"], "v2_atalho_cursos": true}'::jsonb,
    observacoes = COALESCE(observacoes, '') || ' | /cadastro-v2 criada com Etapa 1 redesenhada (5 perfis + cursos transversais). /cadastro original intacto.'
WHERE sessao_codigo = 'HOMOLOG_CATALOGO_COMPLETO_2026_05_15';

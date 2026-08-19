-- ============================================================================
-- DIAGNÓSTICO — CPF 052.641.421-90 em dois cadastros (IDs 132 e 230)
--
-- A consulta de duplicidade rodada em 19/08/2026 devolveu uma única linha:
-- o CPF 05264142190 aparece nos clientes 132 e 230. Antes de decidir o que
-- fazer com esse par (fundir, arquivar um, excluir um), é preciso saber qual
-- dos dois está vivo — quem tem documentos, processo, venda, contrato e login.
--
-- Roda tudo de uma vez. Nada aqui altera dado: são só SELECTs.
-- ============================================================================

-- 1) Conferência que ficou faltando: o cadastro 237 recebeu os dados revisados
--    na Etapa 4 da Central de Adesão?
SELECT id, nome_completo, cpf, email, celular,
       endereco, numero, complemento, bairro, cidade, estado, cep,
       arquivado, excluido, created_at, updated_at
FROM public.qa_clientes
WHERE id = 237;

-- 2) Os dois cadastros do CPF duplicado, lado a lado.
SELECT id, nome_completo, cpf, email, celular,
       endereco, numero, complemento, bairro, cidade, estado, cep,
       user_id, customer_id, arquivado, excluido, created_at, updated_at
FROM public.qa_clientes
WHERE id IN (132, 230)
ORDER BY id;

-- 3) O que está pendurado em cada um dos dois IDs.
SELECT 'qa_documentos_cliente' AS tabela,
       count(*) FILTER (WHERE qa_cliente_id = 132) AS id_132,
       count(*) FILTER (WHERE qa_cliente_id = 230) AS id_230
FROM public.qa_documentos_cliente
UNION ALL
SELECT 'qa_processos',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_processos
UNION ALL
SELECT 'qa_processo_documentos',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_processo_documentos
UNION ALL
SELECT 'qa_solicitacoes_servico',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_solicitacoes_servico
UNION ALL
SELECT 'qa_vendas',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_vendas
UNION ALL
SELECT 'qa_contracts',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_contracts
UNION ALL
SELECT 'cliente_auth_links',
       count(*) FILTER (WHERE qa_cliente_id = 132),
       count(*) FILTER (WHERE qa_cliente_id = 230)
FROM public.cliente_auth_links
UNION ALL
SELECT 'qa_cliente_credenciais',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_cliente_credenciais
UNION ALL
SELECT 'qa_cliente_armas',
       count(*) FILTER (WHERE qa_cliente_id = 132),
       count(*) FILTER (WHERE qa_cliente_id = 230)
FROM public.qa_cliente_armas
UNION ALL
SELECT 'qa_crafs',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_crafs
UNION ALL
SELECT 'qa_gtes',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_gtes
UNION ALL
SELECT 'qa_municoes',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_municoes
UNION ALL
SELECT 'qa_exames_cliente',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_exames_cliente
UNION ALL
SELECT 'qa_procuracoes',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_procuracoes
UNION ALL
SELECT 'qa_arsenal_assinaturas',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_arsenal_assinaturas
UNION ALL
SELECT 'qa_chat_sessoes',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_chat_sessoes
UNION ALL
SELECT 'qa_notificacoes_cliente',
       count(*) FILTER (WHERE cliente_id = 132),
       count(*) FILTER (WHERE cliente_id = 230)
FROM public.qa_notificacoes_cliente
ORDER BY 1;

-- 4) O login de cada um: quem consegue entrar na área do cliente hoje.
SELECT qa_cliente_id, user_id, email, documento_normalizado, status, activated_at
FROM public.cliente_auth_links
WHERE qa_cliente_id IN (132, 230)
ORDER BY qa_cliente_id;

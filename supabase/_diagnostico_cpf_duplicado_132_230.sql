-- ============================================================================
-- DIAGNÓSTICO — CPF 052.641.421-90 em dois cadastros (IDs 132 e 230)
--                + conferência do cadastro 237 (Etapa 4 da Central de Adesão)
--
-- POR QUE ESTE ARQUIVO MUDOU.
-- A primeira versão trazia quatro consultas separadas. O SQL Editor do Supabase
-- só mostra (e só exporta) o resultado da ÚLTIMA consulta do bloco, então as
-- outras três se perdiam no caminho. Agora é UMA consulta só: tudo volta em um
-- único resultado, em três blocos — cadastro, vinculos e login.
--
-- Não altera dado nenhum: é só leitura.
-- ============================================================================

WITH vinculos AS (
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
)
SELECT 'cadastro' AS bloco,
       id::text AS chave,
       concat_ws(' | ',
         nome_completo,
         cpf,
         coalesce(email, '(sem e-mail)'),
         coalesce(celular, '(sem celular)'),
         concat_ws(', ', endereco, numero, complemento, bairro, cidade, estado, cep),
         'user_id=' || coalesce(user_id::text, '-'),
         'arquivado=' || coalesce(arquivado::text, '-'),
         'excluido=' || coalesce(excluido::text, '-'),
         'criado=' || coalesce(to_char(created_at, 'DD/MM/YYYY HH24:MI'), '-'),
         'atualizado=' || coalesce(to_char(updated_at, 'DD/MM/YYYY HH24:MI'), '-')
       ) AS valor
FROM public.qa_clientes
WHERE id IN (132, 230, 237)

UNION ALL

SELECT 'vinculos', tabela, format('132=%s | 230=%s', id_132, id_230)
FROM vinculos

UNION ALL

SELECT 'login', qa_cliente_id::text,
       concat_ws(' | ',
         coalesce(email, '(sem e-mail)'),
         coalesce(documento_normalizado, '(sem doc)'),
         'status=' || coalesce(status, '-'),
         'user_id=' || coalesce(user_id::text, '-'),
         'ativado=' || coalesce(to_char(activated_at, 'DD/MM/YYYY HH24:MI'), '-')
       )
FROM public.cliente_auth_links
WHERE qa_cliente_id IN (132, 230)

ORDER BY 1, 2;

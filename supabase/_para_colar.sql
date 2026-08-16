-- ============================================================================
-- LEVANTAMENTO — REQUERIMENTO GERADO PELO PRÓPRIO CLIENTE
-- ----------------------------------------------------------------------------
-- Bloco 100% de LEITURA (só SELECT). Não altera nada, pode rodar em produção.
-- Rode as 6 consultas de uma vez e me mande os 6 resultados.
-- ============================================================================

-- 1) A exigência do requerimento já tem modelo preenchível (template_key)?
--    É isso que faz o botão "gerar preenchido" existir. Sem template_key,
--    o cliente só recebe um PDF em branco.
SELECT sd.servico_id,
       s.nome_servico,
       sd.id,
       sd.tipo_documento,
       sd.nome_documento,
       sd.etapa,
       sd.obrigatorio,
       sd.ativo,
       sd.modelo_url,
       sd.exemplo_url,
       sd.link_emissao,
       sd.regra_validacao,
       sd.regra_validacao ->> 'template_key'  AS template_key,
       sd.regra_validacao -> 'template_quando' AS template_quando,
       sd.instrucoes,
       sd.observacoes_cliente
  FROM public.qa_servicos_documentos sd
  LEFT JOIN public.qa_servicos s ON s.id = sd.servico_id
 WHERE sd.tipo_documento ILIKE '%requerimento%'
    OR lower(sd.nome_documento) LIKE '%requerimento%'
 ORDER BY sd.servico_id, sd.etapa, sd.ordem;

-- 2) O que a Biblioteca de documentos diz sobre o requerimento
--    (é daqui que sai o texto "como enviar" que o cliente lê no portal).
SELECT id,
       codigo,
       nome,
       categoria,
       ativo,
       emissor_padrao,
       validade_dias,
       link_emissao,
       link_modelo,
       descricao_o_que_e,
       descricao_como_enviar,
       observacao_cliente,
       base_legal
  FROM public.qa_documentos_biblioteca
 WHERE codigo ILIKE '%requerimento%'
    OR lower(nome) LIKE '%requerimento%'
 ORDER BY ativo DESC, nome;

-- 3) Quais modelos .docx preenchíveis já existem no storage
--    (é a lista de chaves que a geração automática consegue usar hoje).
SELECT name AS caminho,
       round((metadata ->> 'size')::numeric / 1024, 1) AS kb,
       created_at,
       updated_at
  FROM storage.objects
 WHERE bucket_id = 'qa-templates'
 ORDER BY name;

-- 4) Todas as exigências que JÁ usam modelo preenchível hoje
--    (serve de espelho: é a configuração que o requerimento precisa copiar).
SELECT sd.servico_id,
       sd.tipo_documento,
       sd.nome_documento,
       sd.regra_validacao ->> 'template_key' AS template_key,
       sd.regra_validacao -> 'template_quando' AS template_quando
  FROM public.qa_servicos_documentos sd
 WHERE sd.ativo
   AND sd.regra_validacao IS NOT NULL
   AND (sd.regra_validacao ? 'template_key' OR sd.regra_validacao ? 'template_quando')
 ORDER BY sd.servico_id, sd.tipo_documento;

-- 5) Tamanho do problema: quantos requerimentos estão pendentes/entregues hoje
SELECT tipo_documento,
       status,
       count(*) AS qtd,
       min(created_at) AS mais_antigo,
       max(created_at) AS mais_recente
  FROM public.qa_documentos_cliente
 WHERE tipo_documento ILIKE '%requerimento%'
 GROUP BY tipo_documento, status
 ORDER BY tipo_documento, qtd DESC;

-- 6) Quão preenchido está o cadastro dos clientes ativos — se faltar dado,
--    o requerimento sai com buraco e o cliente vai ter que responder wizard.
SELECT count(*)                                                   AS clientes,
       count(*) FILTER (WHERE nome_completo   IS NOT NULL AND nome_completo   <> '') AS com_nome,
       count(*) FILTER (WHERE cpf             IS NOT NULL AND cpf             <> '') AS com_cpf,
       count(*) FILTER (WHERE rg              IS NOT NULL AND rg              <> '') AS com_rg,
       count(*) FILTER (WHERE data_nascimento IS NOT NULL)                           AS com_nascimento,
       count(*) FILTER (WHERE nome_mae        IS NOT NULL AND nome_mae        <> '') AS com_nome_mae,
       count(*) FILTER (WHERE endereco        IS NOT NULL AND endereco        <> '') AS com_endereco,
       count(*) FILTER (WHERE cep             IS NOT NULL AND cep             <> '') AS com_cep,
       count(*) FILTER (WHERE profissao       IS NOT NULL AND profissao       <> '') AS com_profissao
  FROM public.qa_clientes
 WHERE NOT coalesce(excluido, false)
   AND NOT coalesce(arquivado, false);

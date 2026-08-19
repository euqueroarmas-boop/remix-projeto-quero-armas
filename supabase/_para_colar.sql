-- ============================================================================
-- FALTAM AS DUAS CONSULTAS QUE DIZEM POR QUE O DOCUMENTO FOI REPROVADO.
-- A do cadastro (que você já rodou) responde outra pergunta — a da conferência
-- campo a campo. Estas duas são as que apontam a causa do "OUTRO DOCUMENTO".
-- Nenhuma altera dado nenhum.
-- ============================================================================

-- 1) O RÓTULO EXATO QUE A LEITURA CRAVOU EM CADA TENTATIVA BLOQUEADA
--    `tipo_lido` é o campo decisivo: ele diz se a leitura errou, se o mapa de
--    tipos não conhecia o rótulo, ou se o navegador estava com a versão velha.
select
  e.created_at,
  e.detalhes->>'codigo'          as codigo,
  e.detalhes->>'tipo_lido'       as tipo_lido,
  e.detalhes->>'tipo_pretendido' as tipo_pretendido,
  e.detalhes->>'exigencia_alvo'  as exigencia_alvo,
  e.detalhes->>'arquivo_nome'    as arquivo_nome,
  e.detalhes->>'arquivo_mime'    as arquivo_mime,
  e.detalhes->>'arquivo_tamanho' as arquivo_tamanho,
  e.ator_tipo,
  e.detalhes->>'motivo'          as motivo
from qa_documentos_cliente_eventos e
left join qa_clientes c on c.id = e.qa_cliente_id
where e.acao = 'tentativa_bloqueada'
  and (c.nome_completo ilike '%ANTHONY NELSON%' or replace(replace(c.cpf,'.',''),'-','') = '30372708889')
order by e.created_at desc
limit 30;

-- 2) O REQUERIMENTO CHEGOU A SER SALVO ALGUMA VEZ?
select
  d.created_at,
  d.tipo_documento,
  d.status,
  d.arquivo_nome,
  d.numero_documento,
  d.data_emissao,
  d.data_validade,
  d.ia_dados_extraidos->>'tipoDetectado' as tipo_detectado,
  d.ia_dados_extraidos->>'confianca'     as confianca
from qa_documentos_cliente d
join qa_clientes c on c.id = d.qa_cliente_id
where (c.nome_completo ilike '%ANTHONY NELSON%' or replace(replace(c.cpf,'.',''),'-','') = '30372708889')
order by d.created_at desc
limit 20;

-- ============================================================================
-- OPCIONAL — só se você decidir que quem está certo é o requerimento.
-- O cadastro diz JARDIM RODEIO; ele digitou Jardim Marica no site da PF.
-- NÃO rode antes de saber qual dos dois é o bairro verdadeiro.
-- ============================================================================
-- update qa_clientes set bairro = 'JARDIM MARICA', updated_at = now()
--  where id = 218;
-- Conferência depois do update:
-- select id, nome_completo, endereco, numero, complemento, bairro, cidade, cep
--   from qa_clientes where id = 218;

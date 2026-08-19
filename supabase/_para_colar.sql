-- ============================================================================
-- DIAGNÓSTICO · REQUERIMENTO DO ANTHONY REPROVADO COMO "OUTRO DOCUMENTO"
-- Cole as três consultas no SQL Editor do Supabase e me mande o resultado.
-- Nenhuma delas altera dado nenhum — são só leituras.
-- ============================================================================

-- 1) O QUE A LEITURA DEVOLVEU EM CADA TENTATIVA BLOQUEADA
--    `tipo_lido` é exatamente o rótulo que a classificação cravou. É este
--    campo que diz se o problema está na leitura, no mapa de tipos ou no slot.
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

-- 3) O CADASTRO QUE VAI SER USADO NA CONFERÊNCIA CAMPO A CAMPO
--    Campo vazio aqui não reprova ninguém (entra como "sem referência"), mas
--    campo PREENCHIDO E DIFERENTE do que ele digitou na PF passa a acusar
--    divergência. É por isso que preciso ver a linha inteira.
select
  id, nome_completo, cpf, nome_mae, nome_pai, data_nascimento, sexo, estado_civil,
  naturalidade_pais, naturalidade_uf, naturalidade_municipio,
  rg, emissor_rg, uf_emissor_rg, expedicao_rg, titulo_eleitor,
  profissao, email, celular,
  cep, endereco, numero, complemento, bairro, cidade, estado
from qa_clientes
where nome_completo ilike '%ANTHONY NELSON%'
   or replace(replace(cpf,'.',''),'-','') = '30372708889';

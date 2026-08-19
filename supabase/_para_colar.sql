-- ============================================================================
-- A CONSULTA 1 QUE EU TE MANDEI ESTAVA ERRADA — ELA PERDIA METADE DA TRILHA.
--
-- A trilha grava DOIS vínculos de cliente: `qa_cliente_id` (envio pela base da
-- equipe) e `customer_id` (envio pelo portal do cliente). Minha consulta ligava
-- só pelo primeiro, então tentativa feita pelo portal simplesmente não aparecia.
-- Estas duas corrigem isso. Nenhuma altera dado nenhum.
-- ============================================================================

-- 1) TENTATIVAS BLOQUEADAS DO ANTHONY, PELOS DOIS VÍNCULOS
--    `tipo_lido` é o campo decisivo: é o rótulo exato que a leitura cravou.
select
  e.created_at,
  e.qa_cliente_id,
  e.customer_id,
  e.ator_tipo,
  e.detalhes->>'codigo'          as codigo,
  e.detalhes->>'tipo_lido'       as tipo_lido,
  e.detalhes->>'tipo_pretendido' as tipo_pretendido,
  e.detalhes->>'exigencia_alvo'  as exigencia_alvo,
  e.detalhes->>'arquivo_nome'    as arquivo_nome,
  e.detalhes->>'arquivo_mime'    as arquivo_mime,
  e.detalhes->>'arquivo_tamanho' as arquivo_tamanho,
  e.detalhes->>'motivo'          as motivo
from qa_documentos_cliente_eventos e
where e.acao = 'tentativa_bloqueada'
  and (
    e.qa_cliente_id = 218
    or e.customer_id = (select customer_id from qa_clientes where id = 218)
  )
order by e.created_at desc
limit 30;

-- 2) REDE DE SEGURANÇA — TODAS AS TENTATIVAS BLOQUEADAS DOS ÚLTIMOS 3 DIAS,
--    DE QUALQUER CLIENTE. Se a de ontem 20:31 tiver sido gravada sem vínculo
--    nenhum, ela aparece aqui. É a consulta que não deixa o caso escapar.
select
  e.created_at,
  e.qa_cliente_id,
  e.customer_id,
  e.ator_tipo,
  e.detalhes->>'codigo'       as codigo,
  e.detalhes->>'tipo_lido'    as tipo_lido,
  e.detalhes->>'exigencia_alvo' as exigencia_alvo,
  e.detalhes->>'arquivo_nome' as arquivo_nome,
  e.detalhes->>'arquivo_mime' as arquivo_mime,
  e.detalhes->>'motivo'       as motivo
from qa_documentos_cliente_eventos e
where e.acao = 'tentativa_bloqueada'
  and e.created_at >= now() - interval '3 days'
order by e.created_at desc
limit 50;

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

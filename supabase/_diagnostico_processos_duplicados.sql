-- ============================================================================
-- PROCESSOS REPETIDOS DO MESMO SERVIÇO — 20/08/2026
--
-- Achado na conferência da trava de pré-requisito: RICARDO ADRIANO MIRANDA
-- (cliente 236) apareceu quatro vezes no resultado. Não é defeito da consulta
-- — ele tem DOIS processos de Autorização de Compra e DOIS de CRAF/GT, e o
-- cruzamento de 2 x 2 dá quatro linhas.
--
-- Pode ser legítimo: para posse, o cliente pode pedir autorização de mais de
-- uma arma. O que decide é a ORIGEM de cada processo — se os dois nasceram da
-- MESMA venda/item, é duplicação; se de vendas diferentes, é serviço a mais
-- que ele contratou.
--
-- A consulta abaixo mostra isso para a base inteira, não só para ele.
-- NÃO ALTERA DADO. É um SELECT.
-- ============================================================================

select c.id                                   as cliente_id,
       c.nome_completo,
       p.servico_id,
       p.servico_nome,
       count(*)                               as processos_do_mesmo_servico,
       count(distinct p.venda_id)              as vendas_distintas,
       array_agg(p.id order by p.data_criacao)             as processos,
       array_agg(p.data_criacao order by p.data_criacao)   as criados_em,
       array_agg(p.venda_id order by p.data_criacao)       as vendas,
       array_agg(p.pagamento_status order by p.data_criacao) as pagamentos,
       array_agg(p.status order by p.data_criacao)         as status,
       case
         when count(distinct p.venda_id) < count(*)
           then 'SUSPEITO — mais de um processo para a mesma venda'
         else 'PROVÁVEL OK — vendas diferentes, serviço contratado mais de uma vez'
       end                                    as leitura
  from qa_processos p
  join qa_clientes c on c.id = p.cliente_id
 where p.status not in ('concluido', 'cancelado')
 group by c.id, c.nome_completo, p.servico_id, p.servico_nome
having count(*) > 1
 order by leitura, c.nome_completo;

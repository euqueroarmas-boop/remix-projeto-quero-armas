-- Diagnóstico: "Failed to send a request to the Edge Function" ao gerar contrato (Ricardo)
-- Rode TUDO de uma vez no SQL Editor do Supabase e me mande os 5 resultados.

-- 1) Quem é o Ricardo (clientes com esse nome, mais recentes primeiro)
select c.id, c.nome_completo, c.cpf, c.email, c.celular, c.created_at
from qa_clientes c
where c.nome_completo ilike '%RICARDO%'
order by c.created_at desc
limit 20;

-- 2) Vendas desses clientes (últimos 15 dias) e o estado de pagamento
select v.id            as venda_id,
       v.id_legado,
       v.cliente_id,
       c.nome_completo,
       v.status,
       v.cobranca_status,
       v.cobranca_origem,
       v.forma_pagamento,
       v.valor_a_pagar,
       v.created_at,
       v.cobranca_confirmada_em
from qa_vendas v
join qa_clientes c on c.id = v.cliente_id
where c.nome_completo ilike '%RICARDO%'
  and v.created_at > now() - interval '15 days'
order by v.created_at desc;

-- 3) Contratos ligados a essas vendas (qa_contracts.venda_id = qa_vendas.id_legado)
select ct.id            as contrato_id,
       ct.contract_number,
       ct.status,
       ct.venda_id      as venda_id_legado,
       ct.cliente_id,
       c.nome_completo,
       ct.original_pdf_path,
       ct.created_at,
       ct.updated_at
from qa_contracts ct
join qa_clientes c on c.id = ct.cliente_id
where c.nome_completo ilike '%RICARDO%'
order by ct.created_at desc
limit 20;

-- 4) Eventos da venda + auditoria de pagamento (mostra se o servidor chegou a rodar)
select e.venda_id, e.tipo_evento, e.descricao, e.ator, e.created_at, e.dados_json
from qa_venda_eventos e
join qa_clientes c on c.id = e.cliente_id
where c.nome_completo ilike '%RICARDO%'
  and e.created_at > now() - interval '15 days'
order by e.created_at desc
limit 50;

-- 5) Vendas PAGAS dos últimos 15 dias que ficaram SEM contrato (qualquer cliente)
select v.id as venda_id, v.id_legado, c.nome_completo, v.status, v.cobranca_status, v.created_at
from qa_vendas v
join qa_clientes c on c.id = v.cliente_id
left join qa_contracts ct on ct.venda_id = v.id_legado
where v.created_at > now() - interval '15 days'
  and ct.id is null
order by v.created_at desc;

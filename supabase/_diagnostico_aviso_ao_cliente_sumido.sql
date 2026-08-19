-- =============================================================================
-- O aviso de certidão recusada está chegando ao PORTAL do cliente?
--
-- No levantamento do atestado do IIRGD, o bloco dos avisos ao cliente veio
-- VAZIO — inclusive para as recusas do Fábio de hoje, 19/08 às 14:12–14:15.
-- Do lado da equipe (qa_admin_notificacoes) elas estão todas lá. Esta consulta
-- separa "não foi gravado" de "foi gravado e já sumiu/expirou".
-- =============================================================================

-- 1) Tudo que existe hoje na caixa de avisos do cliente, por tipo.
select
  categoria,
  urgencia,
  count(*)                                             as avisos,
  count(*) filter (where ativa)                        as ativos,
  count(*) filter (where expira_em < now())            as expirados,
  to_char(min(created_at), 'DD/MM/YYYY')               as primeiro,
  to_char(max(created_at), 'DD/MM/YYYY HH24:MI')       as ultimo
from qa_notificacoes_cliente
group by categoria, urgencia
order by ultimo desc nulls last;

-- 2) Os avisos do dia 19/08, sem filtro nenhum: se as recusas do Fábio
--    tivessem sido gravadas, elas estariam aqui.
select
  to_char(a.created_at, 'DD/MM/YYYY HH24:MI') as quando,
  a.cliente_id,
  cl.nome_completo,
  a.categoria,
  a.urgencia,
  a.titulo,
  left(a.mensagem, 200) as mensagem,
  a.ativa,
  a.expira_em
from qa_notificacoes_cliente a
left join qa_clientes cl on cl.id = a.cliente_id
where a.created_at >= date '2026-08-19'
order by a.created_at desc;

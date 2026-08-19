-- =============================================================================
-- Quem mais mandou o atestado da SSP-SP (IIRGD) e o que aconteceu com ele
--
-- Contexto: certidão recusada na conferência NÃO é gravada (nem no Hub nem no
-- portal). Por isso a ausência de linha em qa_documentos_cliente não prova que
-- não aconteceu — o rastro da recusa está nas notificações.
-- =============================================================================

-- 1) Atestados do IIRGD que chegaram a ser SALVOS, com o que a leitura entendeu
--    por filiação. Filiação com número no lugar de nome = o defeito do Fábio.
select
  d.id,
  d.qa_cliente_id,
  c.nome_completo,
  d.tipo_documento,
  d.created_at,
  d.status,
  d.ia_dados_extraidos->>'lido_por'                                as lido_por,
  d.ia_dados_extraidos->>'parser_veredicto'                        as veredicto,
  d.ia_dados_extraidos->'auditoria_leitura'->>'orgao_identificado' as orgao,
  d.ia_dados_extraidos->'auditoria_leitura'->'filiacao_lida'       as filiacao_lida,
  d.ia_dados_extraidos->'parser'->>'rg'                            as rg_lido,
  d.ia_dados_extraidos->'parser'->>'resultado'                     as resultado_lido,
  d.ia_dados_extraidos->'auditoria_leitura'->'achados'             as achados
from qa_documentos_cliente d
left join qa_clientes c on c.id = d.qa_cliente_id
where d.ia_dados_extraidos->'auditoria_leitura'->>'orgao_identificado' = 'iirgd'
   or d.ia_dados_extraidos->'parser'->>'orgao' = 'iirgd'
   or d.ia_dados_extraidos->'auditoria_leitura'->>'texto_lido' ilike '%GUMBLETON%'
   or d.ia_dados_extraidos->'auditoria_leitura'->>'texto_lido' ilike '%IIRGD%'
order by d.created_at desc;

-- 2) Panorama: tudo o que o parser leu, por órgão e veredicto. Mostra se o
--    atestado da SSP-SP é raro no acervo ou se só não deixou rastro.
select
  coalesce(d.ia_dados_extraidos->'auditoria_leitura'->>'orgao_identificado',
           d.ia_dados_extraidos->'parser'->>'orgao', '(sem órgão)') as orgao,
  coalesce(d.ia_dados_extraidos->>'parser_veredicto', '(sem veredicto)') as veredicto,
  count(*) as documentos,
  min(d.created_at) as primeiro,
  max(d.created_at) as ultimo
from qa_documentos_cliente d
where d.ia_dados_extraidos->>'lido_por' = 'parser'
group by 1, 2
order by documentos desc;

-- 3) Recusas de certidão que a equipe recebeu na Central de Notificação.
--    É AQUI que a recusa aparece, porque o documento recusado não é gravado.
select
  n.created_at,
  n.cliente_id,
  n.cliente_nome,
  n.documento_nome,
  n.titulo,
  n.mensagem,
  n.metadata
from qa_admin_notificacoes n
where n.tipo = 'documento'
  and n.status = 'rejeitado'
  and (n.documento_nome ilike '%antecedente%'
       or n.mensagem     ilike '%antecedente%'
       or n.metadata::text ilike '%antecedente%'
       or n.metadata::text ilike '%iirgd%'
       or n.metadata::text ilike '%filia%')
order by n.created_at desc;

-- 4) O mesmo pelo lado do cliente: avisos de certidão recusada enviados.
select
  a.created_at,
  a.cliente_id,
  cl.nome_completo,
  a.titulo,
  a.mensagem
from qa_notificacoes_cliente a
left join qa_clientes cl on cl.id = a.cliente_id
where a.urgencia = 'alta'
  and (a.titulo ilike '%certid%' or a.mensagem ilike '%Divergência em%')
order by a.created_at desc;

-- 5) A recusa por filiação só dispara quando o cadastro tem o nome da mãe.
--    Sem ele, o mesmo documento apenas ficava "em conferência manual".
select
  count(*)                                                as clientes,
  count(*) filter (where nullif(trim(nome_mae), '') is not null) as com_nome_da_mae,
  count(*) filter (where nullif(trim(nome_mae), '') is null)     as sem_nome_da_mae
from qa_clientes
where coalesce(excluido, false) = false;

-- =============================================================================
-- Alcance do defeito de leitura do atestado da SSP-SP (IIRGD)
--
-- CONSULTA ÚNICA: o SQL Editor do Supabase exporta só o último resultado, então
-- os quatro levantamentos vêm empilhados em uma tabela só, separados por
-- `bloco`.
--
--   bloco 1 → atestados do IIRGD que chegaram a ser SALVOS e o que a leitura
--             entendeu por filiação (número no lugar de nome = o defeito)
--   bloco 2 → panorama de tudo que o parser leu, por órgão e veredicto
--   bloco 3 → recusas que chegaram à equipe na Central de Notificação
--   bloco 4 → avisos de recusa enviados ao cliente
--
-- Lembrete do contexto: certidão recusada NÃO é gravada (nem no Hub nem no
-- portal). Por isso o bloco 1 pode vir vazio mesmo tendo acontecido — quem
-- guarda o rastro da recusa são os blocos 3 e 4.
-- =============================================================================

with iirgd as (
  select
    1                                                            as bloco,
    'atestado do IIRGD salvo'                                    as o_que,
    to_char(d.created_at, 'DD/MM/YYYY HH24:MI')                  as quando,
    coalesce(c.nome_completo, '(sem cadastro)')                   as cliente,
    concat_ws(' | ', 'tipo: ' || coalesce(d.tipo_documento, '-'),
                     'status: ' || coalesce(d.status, '-'),
                     'lido por: ' || coalesce(d.ia_dados_extraidos->>'lido_por', '-')) as detalhe_1,
    concat_ws(' | ', 'veredicto: ' || coalesce(d.ia_dados_extraidos->>'parser_veredicto', '-'),
                     'orgao: ' || coalesce(d.ia_dados_extraidos->'auditoria_leitura'->>'orgao_identificado',
                                           d.ia_dados_extraidos->'parser'->>'orgao', '-')) as detalhe_2,
    concat_ws(' | ', 'filiacao lida: ' || coalesce(d.ia_dados_extraidos->'auditoria_leitura'->>'filiacao_lida', '-'),
                     'rg: ' || coalesce(d.ia_dados_extraidos->'parser'->>'rg', '-'),
                     'resultado: ' || coalesce(d.ia_dados_extraidos->'parser'->>'resultado', '-')) as detalhe_3,
    d.created_at                                                 as ordem
  from qa_documentos_cliente d
  left join qa_clientes c on c.id = d.qa_cliente_id
  where d.ia_dados_extraidos->'auditoria_leitura'->>'orgao_identificado' = 'iirgd'
     or d.ia_dados_extraidos->'parser'->>'orgao' = 'iirgd'
     or d.ia_dados_extraidos->'auditoria_leitura'->>'texto_lido' ilike '%GUMBLETON%'
     or d.ia_dados_extraidos->'auditoria_leitura'->>'texto_lido' ilike '%IIRGD%'
     or d.ia_dados_extraidos->'auditoria_leitura'->>'texto_lido' ilike '%Atestado de Antecedentes%'
),

panorama as (
  select
    2                                                            as bloco,
    'panorama do parser'                                         as o_que,
    to_char(max(d.created_at), 'DD/MM/YYYY')                     as quando,
    coalesce(d.ia_dados_extraidos->'auditoria_leitura'->>'orgao_identificado',
             d.ia_dados_extraidos->'parser'->>'orgao', '(sem orgao)') as cliente,
    'veredicto: ' || coalesce(d.ia_dados_extraidos->>'parser_veredicto', '(sem veredicto)') as detalhe_1,
    'documentos: ' || count(*)::text                              as detalhe_2,
    'de ' || to_char(min(d.created_at), 'DD/MM/YYYY') ||
    ' ate ' || to_char(max(d.created_at), 'DD/MM/YYYY')           as detalhe_3,
    max(d.created_at)                                            as ordem
  from qa_documentos_cliente d
  where d.ia_dados_extraidos->>'lido_por' = 'parser'
  group by 4, 5
),

recusas_equipe as (
  select
    3                                                            as bloco,
    'recusa vista pela equipe'                                   as o_que,
    to_char(n.created_at, 'DD/MM/YYYY HH24:MI')                  as quando,
    coalesce(n.cliente_nome, '(sem nome)')                        as cliente,
    coalesce(n.documento_nome, n.titulo, '-')                     as detalhe_1,
    left(coalesce(n.mensagem, '-'), 300)                          as detalhe_2,
    left(coalesce(n.metadata::text, '-'), 500)                    as detalhe_3,
    n.created_at                                                 as ordem
  from qa_admin_notificacoes n
  where n.tipo = 'documento'
    and n.status = 'rejeitado'
    and (n.documento_nome  ilike '%antecedente%'
      or n.titulo          ilike '%certid%'
      or n.mensagem        ilike '%antecedente%'
      or n.metadata::text  ilike '%antecedente%'
      or n.metadata::text  ilike '%iirgd%'
      or n.metadata::text  ilike '%filia%')
),

avisos_cliente as (
  select
    4                                                            as bloco,
    'aviso enviado ao cliente'                                   as o_que,
    to_char(a.created_at, 'DD/MM/YYYY HH24:MI')                  as quando,
    coalesce(cl.nome_completo, '(sem cadastro)')                  as cliente,
    coalesce(a.titulo, '-')                                       as detalhe_1,
    left(coalesce(a.mensagem, '-'), 300)                          as detalhe_2,
    'urgencia: ' || coalesce(a.urgencia, '-')                     as detalhe_3,
    a.created_at                                                 as ordem
  from qa_notificacoes_cliente a
  left join qa_clientes cl on cl.id = a.cliente_id
  where a.urgencia = 'alta'
    and (a.titulo ilike '%certid%' or a.mensagem ilike '%Divergencia em%' or a.mensagem ilike '%Divergência em%')
)

select bloco, o_que, quando, cliente, detalhe_1, detalhe_2, detalhe_3
from (
  select * from iirgd
  union all select * from panorama
  union all select * from recusas_equipe
  union all select * from avisos_cliente
) t
order by bloco, ordem desc nulls last;

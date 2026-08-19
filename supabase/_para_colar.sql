-- ============================================================================
-- CHECKLIST DO PROCESSO DO ANTHONY — o que ainda está em aberto e em que ordem
-- Só leitura. É esta lista que decide o que o assistente oferece ao cliente.
-- ============================================================================

-- 1) TODOS OS ITENS DO CHECKLIST, NA ORDEM EM QUE O ASSISTENTE OS APRESENTA
select
  d.ordem,
  d.etapa,
  d.tipo_documento,
  d.nome_documento,
  d.status,
  d.obrigatorio,
  d.data_envio,
  d.data_validacao,
  d.motivo_rejeicao,
  d.created_at
from qa_processo_documentos d
join qa_processos p on p.id = d.processo_id
where p.cliente_id = 218
order by coalesce(d.ordem, 9999), d.created_at;

-- 2) O PROCESSO EM SI — etapa liberada, status e pagamento
select
  id,
  servico_nome,
  status,
  pagamento_status,
  etapa_liberada_ate,
  suporte_ativo,
  primeiro_doc_aprovado_em,
  protocolo_numero,
  protocolo_data,
  data_criacao
from qa_processos
where cliente_id = 218;

-- 3) SÓ OS ITENS AINDA PENDENTES — é o que o cliente vê como "4 pendências"
select
  d.ordem,
  d.tipo_documento,
  d.nome_documento,
  d.status
from qa_processo_documentos d
join qa_processos p on p.id = d.processo_id
where p.cliente_id = 218
  and d.obrigatorio = true
  and d.status not in ('aprovado', 'validado', 'dispensado', 'cancelado')
order by coalesce(d.ordem, 9999), d.created_at;

-- Correção operacional: processos/checklists devem usar qa_clientes.id REAL,
-- enquanto vendas/itens podem permanecer com chaves legadas.

-- 1) Normaliza processos que porventura tenham sido gravados com id_legado.
UPDATE public.qa_processos p
SET cliente_id = c.id
FROM public.qa_clientes c
WHERE p.cliente_id = c.id_legado
  AND c.id IS DISTINCT FROM c.id_legado;

-- 2) Normaliza documentos de processo pelo cliente canônico do processo.
UPDATE public.qa_processo_documentos d
SET cliente_id = p.cliente_id
FROM public.qa_processos p
WHERE d.processo_id = p.id
  AND d.cliente_id IS DISTINCT FROM p.cliente_id;

-- 3) Normaliza solicitações que tenham sido gravadas com id_legado.
UPDATE public.qa_solicitacoes_servico s
SET cliente_id = c.id
FROM public.qa_clientes c
WHERE s.cliente_id = c.id_legado
  AND c.id IS DISTINCT FROM c.id_legado;

-- 4) Para liberações concluídas onde o processo existe, marca a solicitação
-- como processo aberto. Não grava qa_processos.id em qa_solicitacoes_servico.processo_id
-- porque esse campo é legado INTEGER, enquanto qa_processos.id é UUID.
UPDATE public.qa_solicitacoes_servico s
SET status_processo = 'processo_aberto'
FROM public.qa_processos p
WHERE s.venda_id = p.venda_id
  AND s.servico_id = p.servico_id
  AND s.cliente_id = p.cliente_id
  AND p.status NOT IN ('cancelado', 'arquivado')
  AND s.status_processo IS DISTINCT FROM 'processo_aberto';

-- 5) Auditoria idempotente para contratos validados cujo estado operacional foi recuperado.
INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
SELECT DISTINCT
  c.id,
  'solicitacao_processo_estado_recuperado',
  jsonb_build_object(
    'processo_id', p.id,
    'solicitacao_id', s.id,
    'venda_id_real', p.venda_id,
    'servico_id', p.servico_id,
    'cliente_id_real', p.cliente_id,
    'origem', 'migration_canonical_client_process_state'
  )
FROM public.qa_contracts c
JOIN public.qa_vendas v ON (v.id = c.venda_id OR v.id_legado = c.venda_id)
JOIN public.qa_processos p ON p.venda_id = v.id
JOIN public.qa_solicitacoes_servico s
  ON s.venda_id = p.venda_id
 AND s.servico_id = p.servico_id
 AND s.cliente_id = p.cliente_id
WHERE c.status = 'validated'
  AND p.status NOT IN ('cancelado', 'arquivado')
  AND NOT EXISTS (
    SELECT 1
    FROM public.qa_contract_events e
    WHERE e.contract_id = c.id
      AND e.event_type = 'solicitacao_processo_estado_recuperado'
      AND (e.event_payload->>'processo_id') = p.id::text
  );
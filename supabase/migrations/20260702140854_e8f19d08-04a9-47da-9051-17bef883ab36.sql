INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
SELECT
  c.id,
  'checklist_criado_por_contrato_validado',
  jsonb_build_object(
    'processo_id', p.id,
    'servico_id', p.servico_id,
    'inseridos', 0,
    'ja_existentes', count(d.id),
    'idempotente', true,
    'origem', 'migration_recover_existing_checklist_event'
  )
FROM public.qa_contracts c
JOIN public.qa_vendas v ON (v.id = c.venda_id OR v.id_legado = c.venda_id)
JOIN public.qa_processos p ON p.venda_id = v.id
JOIN public.qa_processo_documentos d ON d.processo_id = p.id
WHERE c.status = 'validated'
  AND p.status NOT IN ('cancelado', 'arquivado')
  AND NOT EXISTS (
    SELECT 1
    FROM public.qa_contract_events e
    WHERE e.contract_id = c.id
      AND e.event_type = 'checklist_criado_por_contrato_validado'
      AND (e.event_payload->>'processo_id') = p.id::text
  )
GROUP BY c.id, p.id, p.servico_id;
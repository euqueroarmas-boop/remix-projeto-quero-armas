DELETE FROM public.qa_contract_events
WHERE contract_id='af64307f-61bd-4770-bdf5-4238716ca8bd'
  AND event_type='contrato_validado_liberacao_concluida'
  AND (event_payload->>'items')::int = 0;
-- HOMOLOG_2C9: preenche slug/nome do snapshot do item órfão para permitir liberação
ALTER TABLE public.qa_contract_items DISABLE TRIGGER USER;
UPDATE public.qa_contract_items
SET service_slug_snapshot='apostilamento-atualizacao',
    service_name_snapshot='APOSTILAMENTO — ATUALIZAÇÃO DE ACERVO'
WHERE id='3dff5725-00fe-44d3-975b-843744fe8e90'
  AND service_slug_snapshot IS NULL;
ALTER TABLE public.qa_contract_items ENABLE TRIGGER USER;
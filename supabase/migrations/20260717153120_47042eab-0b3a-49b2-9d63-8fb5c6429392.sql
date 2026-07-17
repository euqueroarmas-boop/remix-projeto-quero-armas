-- Reset slots 2022 e 2024 do processo para pendente para permitir revinculação pelo Hub
UPDATE public.qa_processo_documentos
SET status='pendente',
    arquivo_storage_key=NULL,
    observacoes='Slot resetado para revinculação automática pelo Hub',
    updated_at=now()
WHERE id IN (
  '1827d865-6a40-44dd-835d-b9c5ad97e364', -- 2022
  '7cdb3be7-8cff-4cb5-a9ed-bf45b1dcdabe'  -- 2024
);

-- Toca os docs 2022 e 2024 aprovados no Hub para disparar o trigger qa_doc_hub_satisfaz_exigencias_processo
UPDATE public.qa_documentos_cliente
SET updated_at=now()
WHERE id IN (
  'e92bc564-b6bf-46db-8345-eb177b5e999d',
  '392643f9-8eae-4a6b-941b-859ace9603d9'
);
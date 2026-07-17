UPDATE public.qa_processo_documentos
SET status='aprovado',
    arquivo_storage_key='cliente-docs/qa-189/endereco/comprovante_residencia/1784301149476_2022.pdf',
    data_validacao=now(),
    decisao_ia='aprovado_auto',
    observacoes='Vinculado ao comprovante de residência 2022 já aprovado no Hub Documental.',
    updated_at=now()
WHERE id='1827d865-6a40-44dd-835d-b9c5ad97e364';

UPDATE public.qa_processo_documentos
SET status='aprovado',
    arquivo_storage_key='cliente-docs/qa-189/endereco/comprovante_residencia/1784299673911_2024.pdf',
    data_validacao=now(),
    decisao_ia='aprovado_auto',
    observacoes='Vinculado ao comprovante de residência 2024 já aprovado no Hub Documental.',
    updated_at=now()
WHERE id='7cdb3be7-8cff-4cb5-a9ed-bf45b1dcdabe';
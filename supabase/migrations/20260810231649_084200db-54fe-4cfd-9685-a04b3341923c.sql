UPDATE public.qa_psico_nao_localizados
SET ocorrencias = 2,
    qa_cliente_id = 218,
    updated_at = now()
WHERE id = '4df2f992-1a92-461e-8af1-acbe07d9989f';

DELETE FROM public.qa_psico_nao_localizados
WHERE id = '5fbdd8ad-566e-43c8-8006-489b4488b57e';
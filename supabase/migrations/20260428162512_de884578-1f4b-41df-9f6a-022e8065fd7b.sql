
UPDATE public.qa_documentos_cliente
SET tipo_documento = 'sinarm',
    ia_status = 'validado',
    validado_admin = true,
    validado_em = now(),
    validado_por = 'sanitizacao_lovable'
WHERE id IN ('c9a73bf3-9d2d-4e29-aa17-53dedced4026', '349132e9-7ea4-436e-a6bc-31c2a20a5e10');

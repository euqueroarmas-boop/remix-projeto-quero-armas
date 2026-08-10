UPDATE public.qa_documentos_cliente
SET status = 'reprovado',
    observacoes = COALESCE(observacoes || E'\n', '') ||
      'REPROVADO (auditoria 10/08/2026): documento é a certidão CÍVEL do TJM/SP (Cartório Cível, ações cíveis). O processo exige a certidão CRIMINAL (Auditorias Criminais). Cliente deve reemitir.',
    updated_at = now()
WHERE id = '86c8f546-268c-4dd1-90af-ca6b2c219d12';
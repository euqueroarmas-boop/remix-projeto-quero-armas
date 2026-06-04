UPDATE public.qa_processos
SET status = 'cancelado',
    observacoes_admin = COALESCE(observacoes_admin,'') || ' [TESTE E2E FASE 6 - CANCELADO]'
WHERE id = 'cdeff63a-c642-44f5-8ab3-9bde4f6299e1';
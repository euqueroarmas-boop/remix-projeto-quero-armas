-- Remove versão antiga sem bypass — evita "Could not choose the best candidate function"
DROP FUNCTION IF EXISTS public.qa_confirmar_pagamento_processo(uuid, text);
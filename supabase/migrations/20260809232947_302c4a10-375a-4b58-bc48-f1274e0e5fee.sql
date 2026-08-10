UPDATE public.qa_tipos_documento_catalogo
SET categoria_hub = 'juridico', exige_validade = false
WHERE tipo_documento = 'comprovante_pagamento';

INSERT INTO public.qa_validade_documentos (tipo_documento, validade_dias, perpetuo, rotulo, observacao)
VALUES ('comprovante_pagamento', 0, true, 'Sem vencimento', 'Comprovante de pagamento do contrato: recibo de fato passado, pertence ao contrato e não vence.')
ON CONFLICT (tipo_documento) DO UPDATE
SET validade_dias = 0, perpetuo = true, rotulo = 'Sem vencimento';

UPDATE public.qa_documentos_cliente
SET data_validade = NULL
WHERE tipo_documento = 'comprovante_pagamento' AND data_validade IS NOT NULL;
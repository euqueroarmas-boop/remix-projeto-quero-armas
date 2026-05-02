-- Concessão CR: Compromisso de Treino (clube fornece, sem template)
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, formato_aceito, ordem, observacoes_cliente)
VALUES
  (31, 'declaracao_compromisso_treino',
   'Declaração de Compromisso de Treino (emitida pelo clube de tiro)',
   'declaracoes', true,
   ARRAY['pdf']::text[],
   50,
   'Documento emitido e assinado digitalmente (GOV.BR/ICP-Brasil) pelo seu clube de tiro. Substitui a comprovação de habitualidade na concessão.')
ON CONFLICT (servico_id, tipo_documento, COALESCE(condicao_profissional, '')) DO NOTHING;

-- Renovação CR: Habitualidade Anexo C (com template pré-preenchido)
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, formato_aceito, ordem, observacoes_cliente)
VALUES
  (32, 'declaracao_compromisso_habitualidade',
   'Declaração de Habitualidade (Anexo C)',
   'declaracoes', true,
   ARRAY['pdf']::text[],
   50,
   'Baixe o modelo pré-preenchido, assine digitalmente no GOV.BR e anexe aqui.')
ON CONFLICT (servico_id, tipo_documento, COALESCE(condicao_profissional, '')) DO NOTHING;
INSERT INTO public.qa_processo_documentos (
  processo_id, cliente_id, tipo_documento, nome_documento, etapa, obrigatorio, formato_aceito,
  status, regra_validacao, instrucoes, observacoes_cliente, link_emissao, orgao_emissor,
  prazo_recomendado_dias, validade_dias
)
SELECT
  p.id, p.cliente_id, sd.tipo_documento, sd.nome_documento, sd.etapa, sd.obrigatorio, sd.formato_aceito,
  'pendente', sd.regra_validacao, sd.instrucoes, sd.observacoes_cliente, sd.link_emissao, sd.orgao_emissor,
  sd.prazo_recomendado_dias, sd.validade_dias
FROM public.qa_processos p
JOIN public.qa_servicos_documentos sd ON sd.servico_id = p.servico_id
WHERE p.servico_id IN (31, 44)
  AND p.status NOT IN ('concluido','cancelado','excluido_lgpd')
  AND sd.tipo_documento IN (
    'pergunta_comprovante_em_nome',
    'pergunta_ainda_reside_imovel',
    'pergunta_responde_inquerito_criminal',
    'declaracao_responsavel_imovel',
    'declaracao_sem_inquerito_processo_criminal'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_processo_documentos pd
    WHERE pd.processo_id = p.id AND pd.tipo_documento = sd.tipo_documento
  );

-- Sincroniza a Declaração de Compromisso de Treino para apontar o template .docx
UPDATE public.qa_processo_documentos pd
SET regra_validacao = sd.regra_validacao,
    instrucoes = COALESCE(NULLIF(pd.instrucoes,''), sd.instrucoes),
    formato_aceito = sd.formato_aceito
FROM public.qa_servicos_documentos sd
JOIN public.qa_processos p ON p.servico_id = sd.servico_id
WHERE pd.processo_id = p.id
  AND pd.tipo_documento = 'declaracao_compromisso_treino'
  AND sd.tipo_documento = 'declaracao_compromisso_treino'
  AND sd.servico_id IN (31,44)
  AND pd.status NOT IN ('aprovado','validado');
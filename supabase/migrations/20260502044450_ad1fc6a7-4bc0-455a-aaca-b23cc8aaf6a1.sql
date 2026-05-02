-- ============= 1) PERGUNTAS-PIVOT =============
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, formato_aceito, ordem, ativo, regra_validacao, instrucoes)
SELECT s.servico_id, 'pergunta_comprovante_em_nome', 'O COMPROVANTE DE RESIDÊNCIA ESTÁ NO SEU NOME?', 'complementar', true, ARRAY[]::text[], 200, true,
  jsonb_build_object('tipo','pergunta','chave','comprovante_em_nome_titular',
    'opcoes', jsonb_build_array(
      jsonb_build_object('valor','sim','label','SIM, ESTÁ NO MEU NOME'),
      jsonb_build_object('valor','nao','label','NÃO, ESTÁ NO NOME DE TERCEIRO'))),
  'RESPONDA PARA AJUSTARMOS AS DECLARAÇÕES NECESSÁRIAS PARA A SUA CONCESSÃO DE CR.'
FROM (VALUES (31),(44)) AS s(servico_id)
WHERE NOT EXISTS (SELECT 1 FROM public.qa_servicos_documentos WHERE servico_id = s.servico_id AND tipo_documento = 'pergunta_comprovante_em_nome');

INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, formato_aceito, ordem, ativo, regra_validacao, instrucoes)
SELECT s.servico_id, 'pergunta_ainda_reside_imovel', 'VOCÊ AINDA RESIDE NESTE IMÓVEL DE TERCEIRO?', 'complementar', true, ARRAY[]::text[], 201, true,
  jsonb_build_object('tipo','pergunta','chave','ainda_reside_imovel',
    'depende_de', jsonb_build_object('chave','comprovante_em_nome_titular','valor','nao'),
    'opcoes', jsonb_build_array(
      jsonb_build_object('valor','sim','label','SIM, AINDA MORO LÁ'),
      jsonb_build_object('valor','nao','label','NÃO, JÁ MUDEI'))),
  'ESSA RESPOSTA DEFINE O MODELO CORRETO DA DECLARAÇÃO DO RESPONSÁVEL PELO IMÓVEL.'
FROM (VALUES (31),(44)) AS s(servico_id)
WHERE NOT EXISTS (SELECT 1 FROM public.qa_servicos_documentos WHERE servico_id = s.servico_id AND tipo_documento = 'pergunta_ainda_reside_imovel');

INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, formato_aceito, ordem, ativo, regra_validacao, instrucoes)
SELECT s.servico_id, 'pergunta_responde_inquerito_criminal', 'VOCÊ RESPONDE A ALGUM INQUÉRITO OU PROCESSO CRIMINAL?', 'complementar', true, ARRAY[]::text[], 202, true,
  jsonb_build_object('tipo','pergunta','chave','responde_inquerito_criminal',
    'opcoes', jsonb_build_array(
      jsonb_build_object('valor','nao','label','NÃO RESPONDO A NENHUM'),
      jsonb_build_object('valor','sim','label','SIM, RESPONDO'))),
  'A POLÍCIA FEDERAL EXIGE DECLARAÇÃO ASSINADA QUANDO O REQUERENTE NÃO RESPONDE A INQUÉRITO/PROCESSO. SE VOCÊ RESPONDE, A EQUIPE TRATARÁ O CASO INDIVIDUALMENTE.'
FROM (VALUES (31),(44)) AS s(servico_id)
WHERE NOT EXISTS (SELECT 1 FROM public.qa_servicos_documentos WHERE servico_id = s.servico_id AND tipo_documento = 'pergunta_responde_inquerito_criminal');

-- ============= 2) DECLARAÇÕES CONDICIONAIS =============
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, formato_aceito, ordem, ativo, regra_validacao, instrucoes, observacoes_cliente)
SELECT s.servico_id, 'declaracao_responsavel_imovel', 'DECLARAÇÃO DO RESPONSÁVEL PELO IMÓVEL', 'complementar', true,
  ARRAY['application/pdf']::text[], 210, true,
  jsonb_build_object(
    'assinatura_requerida','govbr',
    'label_botao','ENVIAR DECLARAÇÃO ASSINADA',
    'template_condicional', true,
    'exige_quando', jsonb_build_object('comprovante_em_nome_titular','nao'),
    'template_quando', jsonb_build_array(
      jsonb_build_object('se', jsonb_build_object('comprovante_em_nome_titular','nao','ainda_reside_imovel','sim'),
        'template_key','declaracao_responsavel_imovel_atual','label','BAIXAR MODELO (RESIDE ATUALMENTE)'),
      jsonb_build_object('se', jsonb_build_object('comprovante_em_nome_titular','nao','ainda_reside_imovel','nao'),
        'template_key','declaracao_responsavel_imovel_passado','label','BAIXAR MODELO (RESIDIU DE/ATÉ)'))),
  '1) RESPONDA AS PERGUNTAS ACIMA. 2) BAIXE O MODELO QUE O SISTEMA LIBERAR JÁ PREENCHIDO COM SEUS DADOS. 3) PEÇA AO RESPONSÁVEL PELO IMÓVEL PARA ASSINAR DIGITALMENTE NO GOV.BR. 4) ANEXE O PDF ASSINADO AQUI — O SISTEMA VALIDARÁ A ASSINATURA AUTOMATICAMENTE.',
  'O RESPONSÁVEL DEVE TER CONTA GOV.BR NÍVEL PRATA OU OURO.'
FROM (VALUES (31),(44)) AS s(servico_id)
WHERE NOT EXISTS (SELECT 1 FROM public.qa_servicos_documentos WHERE servico_id = s.servico_id AND tipo_documento = 'declaracao_responsavel_imovel');

INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, formato_aceito, ordem, ativo, regra_validacao, instrucoes)
SELECT s.servico_id, 'declaracao_sem_inquerito_processo_criminal', 'DECLARAÇÃO DE NÃO RESPONDER A INQUÉRITO/PROCESSO CRIMINAL', 'complementar', true,
  ARRAY['application/pdf']::text[], 211, true,
  jsonb_build_object(
    'assinatura_requerida','govbr',
    'label_botao','ENVIAR DECLARAÇÃO ASSINADA',
    'template_key','declaracao_sem_inquerito_processo_criminal',
    'exige_quando', jsonb_build_object('responde_inquerito_criminal','nao')),
  '1) RESPONDA "NÃO RESPONDO A NENHUM" NA PERGUNTA ACIMA. 2) BAIXE O MODELO JÁ PREENCHIDO COM SEUS DADOS. 3) ASSINE NO GOV.BR. 4) ANEXE O PDF ASSINADO AQUI.'
FROM (VALUES (31),(44)) AS s(servico_id)
WHERE NOT EXISTS (SELECT 1 FROM public.qa_servicos_documentos WHERE servico_id = s.servico_id AND tipo_documento = 'declaracao_sem_inquerito_processo_criminal');

-- ============= 3) ATUALIZA Declaração de Compromisso de Treino =============
UPDATE public.qa_servicos_documentos
SET regra_validacao = jsonb_build_object(
      'assinatura_requerida','govbr',
      'label_botao','ENVIAR DECLARAÇÃO ASSINADA',
      'template_key','declaracao_compromisso_habitualidade'),
    instrucoes = '1) BAIXE O MODELO JÁ PREENCHIDO COM SEUS DADOS. 2) ASSINE DIGITALMENTE NO GOV.BR. 3) ANEXE AQUI O PDF ASSINADO — O SISTEMA VALIDA A ASSINATURA AUTOMATICAMENTE.',
    formato_aceito = ARRAY['application/pdf']::text[]
WHERE servico_id IN (31,44) AND tipo_documento = 'declaracao_compromisso_treino';

-- ============= 4) MATERIALIZAR EM PROCESSOS ATIVOS =============
INSERT INTO public.qa_processo_documentos (
  processo_id, cliente_id, tipo_documento, nome_documento, etapa, obrigatorio, formato_aceito,
  status, regra_validacao, instrucoes, observacoes_cliente, link_emissao, orgao_emissor,
  prazo_recomendado_dias, validade_dias)
SELECT p.id, p.cliente_id, sd.tipo_documento, sd.nome_documento, sd.etapa, sd.obrigatorio, sd.formato_aceito,
  'pendente', sd.regra_validacao, sd.instrucoes, sd.observacoes_cliente, sd.link_emissao, sd.orgao_emissor,
  sd.prazo_recomendado_dias, sd.validade_dias
FROM public.qa_processos p
JOIN public.qa_servicos_documentos sd ON sd.servico_id = p.servico_id
WHERE p.servico_id IN (31, 44)
  AND p.status NOT IN ('concluido','cancelado','excluido_lgpd')
  AND sd.tipo_documento IN (
    'pergunta_comprovante_em_nome','pergunta_ainda_reside_imovel','pergunta_responde_inquerito_criminal',
    'declaracao_responsavel_imovel','declaracao_sem_inquerito_processo_criminal')
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_processo_documentos pd
    WHERE pd.processo_id = p.id AND pd.tipo_documento = sd.tipo_documento);

-- 4.1 Sincroniza Declaração de Compromisso de Treino existente
UPDATE public.qa_processo_documentos pd
SET regra_validacao = sd.regra_validacao,
    instrucoes = COALESCE(NULLIF(pd.instrucoes,''), sd.instrucoes),
    formato_aceito = sd.formato_aceito
FROM public.qa_servicos_documentos sd, public.qa_processos p
WHERE pd.processo_id = p.id
  AND p.servico_id = sd.servico_id
  AND pd.tipo_documento = 'declaracao_compromisso_treino'
  AND sd.tipo_documento = 'declaracao_compromisso_treino'
  AND sd.servico_id IN (31,44)
  AND pd.status NOT IN ('aprovado','validado');
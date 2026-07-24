-- =============================================================================
-- Popula qa_servicos_documentos.instrucoes a partir do catálogo estático
-- (pendenciasExplicacoes.ts). Atualiza SOMENTE linhas que ainda estão com
-- instrucoes IS NULL ou vazio, preservando edições manuais do admin.
-- Fonte: src/lib/quero-armas/pendenciasExplicacoes.ts
-- =============================================================================

DO $$
DECLARE
  v_sql text;
  v_rows int;
BEGIN
  -- Helper: UPDATE com idempotência (não sobrescreve instrucoes já preenchidas)
  -- Cada bloco: (tipo_documento, instrucoes, observacao)
  WITH dados (tipo_documento, instrucoes, observacao) AS (VALUES
    ('requerimento_de_posse_de_arma_de_fogo',
     E'Baixe o modelo do requerimento no Hub Documental (aba "Baixar modelo").\nPreencha com sua letra ou digite, assine e escaneie em PDF.\nEnvie o PDF assinado — a IA confere se os dados batem com seu cadastro.',
     'Este é o formulário oficial que instrui o processo perante a Polícia Federal.'),

    ('declaracao_necessidade_efetiva',
     E'Baixe o modelo no Hub Documental e preencha com o motivo real da posse.\nAssine (à mão ou via Gov.br) e envie o PDF.',
     'A justificativa precisa ser coerente com o serviço contratado.'),

    ('declaracao_compromisso_treino',
     E'Baixe o modelo padrão do sistema no Hub Documental.\nAssine e envie o PDF — não altere o texto do modelo.',
     NULL),

    ('declaracao_compromisso_habitualidade',
     E'Baixe o modelo no Hub Documental, assine e envie o PDF.\nSe ainda não é filiado a clube, faça isso antes de assinar.',
     NULL),

    ('declaracao_habitualidade_clube',
     E'Solicite a declaração ao seu clube de tiro atestando frequência mínima de treinos.\nEnvie o PDF assinado pelo clube (carimbo/assinatura do responsável).',
     NULL),

    ('pergunta_ainda_reside_imovel',
     E'Abra o Hub e responda Sim ou Não.\nSe Sim, seguimos com o comprovante em nome de terceiro + documento do titular.\nSe Não, você será orientado a enviar um comprovante em seu nome.',
     NULL),

    ('pergunta_comprovante_em_nome',
     E'Abra o Hub e responda Sim ou Não.\nSe Não, o sistema já pede a declaração do titular e o documento dele.',
     NULL),

    ('pergunta_responde_inquerito_criminal',
     E'Abra o Hub e responda Sim ou Não.\nSe Não, o sistema gera a declaração automaticamente para você assinar.',
     NULL),

    ('renda_definir_condicao',
     E'Abra o Hub e escolha entre CLT, servidor público, autônomo/MEI, empresário ou aposentado.\nA partir da escolha, o sistema pede automaticamente os comprovantes certos.',
     NULL),

    ('documento_identificacao_terceiro',
     E'Se o comprovante de residência está em nome de outra pessoa, envie um documento oficial dela (RG/CNH/CIN).\nFrente e verso, legível, dentro da validade.',
     NULL),

    ('renda_nf_empresa',
     E'Envie uma NF emitida pela empresa para um cliente nos últimos meses.\nServe como comprovação de atividade e faturamento.',
     NULL),

    ('renda_qsa',
     E'Emita o QSA no site da Receita Federal (últimos 30 dias) e envie o PDF.',
     NULL),

    ('certidao_antecedentes_criminais_eleitoral',
     E'Emita a certidão no site do TSE e envie o PDF original.',
     NULL),

    ('certidao_antecedentes_criminais_estadual',
     E'Emita a certidão no portal do Tribunal de Justiça do seu estado.\nEnvie o PDF original assinado digitalmente.',
     NULL),

    ('certidao_antecedentes_criminais_federal',
     E'Emita a certidão no portal da Justiça Federal da sua região.\nEnvie o PDF exatamente como baixado.',
     NULL),

    ('certidao_antecedentes_criminais_militar',
     E'Emita a certidão no STM (federal) ou TJM-SP (estadual), conforme solicitado.\nEnvie o PDF original.',
     NULL),

    ('certidao_antecedentes_policia_civil_sp',
     E'Emita a certidão no site da Polícia Civil de São Paulo.\nEnvie o PDF original — o sistema valida a assinatura digital.',
     NULL),

    ('certidao_crimes_eleitorais_tse',
     E'Emita a certidão no site do TSE.\nEnvie o PDF original assinado.',
     NULL),

    ('certidao_crimes_militares_stm',
     E'Emita a certidão no portal do Superior Tribunal Militar (STM).\nEnvie o PDF original.',
     NULL),

    ('certidao_criminal_tjmsp',
     E'Emita a certidão no portal do Tribunal de Justiça Militar de SP (TJM-SP).\nEnvie o PDF original.',
     NULL),

    ('certidao_estadual_distribuicao_acoes_criminais',
     E'Emita no portal do Tribunal de Justiça a certidão de distribuição criminal.\nNão envie a de execuções — são certidões distintas.',
     NULL),

    ('certidao_estadual_execucoes_criminais',
     E'Emita no portal do Tribunal de Justiça a certidão de execuções criminais.\nNão envie a de distribuição — são certidões distintas.',
     NULL),

    ('certidao_estadual_segundo_grau_acoes_criminais',
     E'Emita a certidão de segundo grau (Tribunal) para ações criminais.',
     NULL),

    ('certidao_estadual_segundo_grau_execucoes_criminais',
     E'Emita a certidão de segundo grau (Tribunal) para execuções criminais.',
     NULL),

    ('certidao_federal_trf3_regional',
     E'Emita no portal do TRF3 a certidão regional (abrangência de todo o TRF3).\nEnvie o PDF original assinado.',
     NULL),

    ('certidao_federal_trf3_sjsp_jef',
     E'No portal do TRF3, emita a certidão da Seção Judiciária de SP (SJSP) e do JEF.\nEnvie o PDF original assinado.',
     NULL),

    ('certidao_tjsp_distribuicao_criminal',
     E'No portal do TJSP, emita a certidão de distribuição criminal.',
     NULL),

    ('certidao_tjsp_execucoes_criminais',
     E'No portal do TJSP, emita a certidão de execuções criminais.',
     NULL),

    ('comprovante_endereco_ano_2022',
     E'Envie uma conta (luz, água, gás, internet, telefone) emitida em 2022.\nO documento comprova o histórico de residência exigido pela PF.',
     NULL),

    ('comprovante_endereco_ano_2023',
     E'Envie uma conta (luz, água, gás, internet, telefone) emitida em 2023.',
     NULL),

    ('comprovante_endereco_ano_2024',
     E'Envie uma conta (luz, água, gás, internet, telefone) emitida em 2024.',
     NULL),

    ('comprovante_endereco_ano_2025',
     E'Envie uma conta (luz, água, gás, internet, telefone) emitida em 2025.',
     NULL),

    ('comprovante_endereco_ano_2026',
     E'Envie uma conta (luz, água, gás, internet, telefone) emitida em 2026.\nDeve ser recente — preferencialmente do mês atual.',
     NULL),

    ('comprovante_endereco_ano_2027',
     E'Envie uma conta recente (luz, água, gás, internet, telefone) emitida em 2027.',
     NULL),

    ('comprovante_filiacao_entidade_tiro',
     E'Envie a carteirinha, contrato ou declaração do clube atestando filiação vigente.\nDeve estar dentro do prazo de validade.',
     NULL),

    ('cin',
     E'Envie um documento oficial com foto, CPF e data de nascimento (CIN, RG com CPF ou CNH).\nO arquivo deve estar legível, colorido e mostrar frente e verso.',
     'Aceita-se PDF ou foto nítida do documento original.'),

    ('rg_com_cpf',
     E'Envie o RG com CPF impresso (frente e verso) ou a nova CIN.\nO documento deve estar dentro da validade e sem cortes.',
     NULL),

    ('cnh',
     E'Envie a CNH dentro do prazo de validade, frente e verso.\nAceita-se a CNH digital exportada em PDF pelo aplicativo oficial.',
     NULL),

    ('cpf',
     E'Envie o comprovante de situação cadastral emitido no site da Receita Federal.',
     NULL),

    ('comprovante_residencia',
     E'Envie conta de luz, água, gás, internet ou telefone em seu nome.\nA emissão deve ser recente — o sistema aceita contas emitidas há até 30 dias.',
     'Se a conta não estiver no seu nome, envie também uma declaração do titular.'),

    ('declaracao_responsavel_imovel',
     E'Se a conta de residência não está no seu nome, o titular precisa assinar uma declaração.\nEnvie o modelo assinado (fisicamente ou via Gov.br) junto com o documento do titular.',
     NULL),

    ('antecedentes_criminais',
     E'Acesse o site da Polícia Civil do seu estado e emita a certidão de antecedentes.\nEnvie o PDF original — não altere o arquivo, o sistema valida a assinatura digital.',
     NULL),

    ('antecedentes_federal',
     E'Emita a certidão no portal da Justiça Federal da sua região.\nEnvie o PDF exatamente como baixado — o sistema confere a autenticidade.',
     NULL),

    ('antecedentes_federal_trf3_regional',
     E'Acesse o portal do TRF3 e emita a certidão regional (abrangência de todo o TRF3).\nEnvie o PDF original assinado.',
     NULL),

    ('antecedentes_federal_sjsp_jef',
     E'No portal do TRF3, emita a certidão da Seção Judiciária de São Paulo (SJSP) e do JEF.\nEnvie o PDF original assinado.',
     NULL),

    ('antecedentes_estadual',
     E'Emita a certidão no portal do Tribunal de Justiça do seu estado.\nEnvie o PDF original.',
     NULL),

    ('antecedentes_estadual_distribuicao',
     E'No portal do TJSP, emita a certidão de distribuição criminal.\nNão envie a de execuções — são certidões diferentes.',
     NULL),

    ('antecedentes_estadual_execucoes',
     E'No portal do TJSP, emita a certidão de execuções criminais.\nNão envie a de distribuição — são certidões diferentes.',
     NULL),

    ('antecedentes_militar',
     E'Emita a certidão no portal do STM (federal) ou do TJM-SP (estadual), conforme solicitado.\nEnvie o PDF original.',
     NULL),

    ('antecedentes_eleitoral',
     E'Emita a certidão de quitação e crimes eleitorais no site do TSE.\nEnvie o PDF original assinado.',
     NULL),

    ('renda_holerite_mes_atual',
     E'Envie o holerite do mês vigente ou do mês anterior.\nDeve conter nome, CPF, empresa e valor líquido.',
     NULL),

    ('renda_holerite_funcionario_publico',
     E'Envie o contracheque atualizado emitido pelo sistema do órgão.',
     NULL),

    ('renda_cartao_cnpj',
     E'Emita o cartão CNPJ no site da Receita Federal (https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp) e envie o PDF.\nO cartão deve ter sido emitido nos últimos 30 dias.',
     NULL),

    ('renda_cnpj_autonomo',
     E'Envie o CCMEI (MEI) ou contrato de prestação de serviço vigente.',
     NULL),

    ('renda_contrato_social',
     E'Envie o contrato social vigente da empresa, com todas as alterações registradas.',
     NULL),

    ('renda_nf_recente',
     E'Envie as notas fiscais dos últimos meses que comprovem faturamento recorrente.',
     NULL),

    ('renda_comprovante_beneficio',
     E'Envie o extrato oficial do benefício (INSS, aposentadoria, pensão) do mês atual.',
     NULL),

    ('renda_extrato_inss',
     E'Acesse Meu INSS e emita o extrato do benefício atual em PDF.',
     NULL),

    ('laudo_psicologico',
     E'Agende o exame com um psicólogo credenciado pela Polícia Federal.\nO laudo deve conter QR Code ou assinatura digital do credenciado.',
     'Se ainda não escolheu um credenciado, use o botão de busca para ver profissionais próximos.'),

    ('laudo_capacidade_tecnica',
     E'Agende o teste com um instrutor de tiro credenciado pela Polícia Federal.\nO laudo deve estar assinado digitalmente pelo instrutor.',
     NULL),

    ('comprovante_clube_tiro',
     E'Envie o comprovante da sua filiação vigente ao clube de tiro (carteirinha, contrato ou declaração).',
     NULL),

    ('comprovante_habitualidade',
     E'Envie a declaração do clube atestando frequência mínima de treinos no período exigido.',
     NULL),

    ('comprovante_competicao',
     E'Envie o boletim/resultado oficial da competição em que participou.',
     NULL),

    ('comprovante_efetiva_necessidade',
     E'Envie os documentos que comprovam a exposição ao risco justificando a posse/porte.',
     NULL),

    ('declaracao_guarda_responsavel',
     E'Envie a declaração assinada de que a arma será guardada em local seguro, longe de menores e incapazes.',
     NULL),

    ('declaracao_guarda_acervo_1endereco',
     E'Envie a declaração assinada informando que todo o acervo está guardado no endereço cadastrado.',
     NULL),

    ('declaracao_sem_inquerito_processo_criminal',
     E'Envie a declaração assinada de que não responde a inquérito nem processo criminal.',
     NULL),

    ('protocolo_processo',
     E'Envie o comprovante de protocolo gerado pelo órgão (PF ou Exército).',
     NULL),

    ('oficio',
     E'Envie o ofício recebido do órgão para registrarmos e continuar a análise.',
     NULL),

    ('despacho',
     E'Envie o despacho recebido do órgão para registrarmos e continuar a análise.',
     NULL),

    ('exigencia',
     E'Envie o documento de exigência recebido do órgão para respondermos dentro do prazo.',
     NULL),

    ('cr',
     E'Envie o CR atual emitido pelo Exército, dentro da validade.',
     NULL),

    ('craf',
     E'Envie o CRAF/SIGMA emitido pelo Exército referente à arma.',
     NULL),

    ('sinarm',
     E'Envie o registro SINARM emitido pela Polícia Federal referente à arma.',
     NULL),

    ('gt',
     E'Envie a GT emitida pelo Exército.',
     NULL),

    ('gte',
     E'Envie a GTE emitida pelo Exército.',
     NULL),

    ('autorizacao_compra',
     E'Envie a autorização de compra deferida pela Polícia Federal ou pelo Exército.',
     NULL),

    ('nota_fiscal_arma',
     E'Envie a nota fiscal emitida pela loja/importadora da arma.',
     NULL),

    ('declaracao_efetiva_necessidade',
     E'Baixe o modelo no Hub Documental e preencha com o motivo real da posse.\nAssine (à mão ou via Gov.br) e envie o PDF.',
     'A justificativa precisa ser coerente com o serviço contratado.')
  )
  UPDATE public.qa_servicos_documentos AS sd
  SET
    instrucoes          = dados.instrucoes,
    observacoes_cliente = COALESCE(sd.observacoes_cliente, dados.observacao)
  FROM dados
  WHERE sd.tipo_documento = dados.tipo_documento
    AND (sd.instrucoes IS NULL OR trim(sd.instrucoes) = '');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE 'qa_servicos_documentos.instrucoes populado: % linhas atualizadas', v_rows;
END $$;

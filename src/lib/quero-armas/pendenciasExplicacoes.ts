// ============================================================================
// pendenciasExplicacoes.ts
// ----------------------------------------------------------------------------
// Copy curto por tipo de pendência, exibido no PendenciasGuiadasPopup.
// Substitui, na Fase 1, o texto instrucional do wizard antigo para cada
// exigência documental. Mantém a linguagem do assistente: título objetivo +
// 1 parágrafo explicando o que enviar. Fallback genérico cobre tipos sem
// entrada explícita.
// ============================================================================

export interface ExplicacaoPendencia {
  titulo: string;
  passos: string[];
  observacao?: string;
}

const REGISTRO: Record<string, ExplicacaoPendencia> = {
  // ────────────────────────────────────────────────────────────────────────
  // Requerimento / formulários do processo
  // ────────────────────────────────────────────────────────────────────────
  requerimento_de_posse_de_arma_de_fogo: {
    titulo: "Requerimento de Posse de Arma de Fogo",
    passos: [
      "Baixe o modelo do requerimento no Hub Documental (aba \"Baixar modelo\").",
      "Preencha com sua letra ou digite, assine e escaneie em PDF.",
      "Envie o PDF assinado — a IA confere se os dados batem com seu cadastro.",
    ],
    observacao: "Este é o formulário oficial que instrui o processo perante a Polícia Federal.",
  },
  declaracao_necessidade_efetiva: {
    titulo: "Declaração de efetiva necessidade",
    passos: [
      "Baixe o modelo no Hub Documental e preencha com o motivo real da posse.",
      "Assine (à mão ou via Gov.br) e envie o PDF.",
    ],
    observacao: "A justificativa precisa ser coerente com o serviço contratado.",
  },
  declaracao_compromisso_treino: {
    titulo: "Declaração de compromisso de treino",
    passos: [
      "Baixe o modelo padrão do sistema no Hub Documental.",
      "Assine e envie o PDF — não altere o texto do modelo.",
    ],
  },
  declaracao_compromisso_habitualidade: {
    titulo: "Declaração de compromisso de habitualidade",
    passos: [
      "Baixe o modelo no Hub Documental, assine e envie o PDF.",
      "Se ainda não é filiado a clube, faça isso antes de assinar.",
    ],
  },
  declaracao_habitualidade_clube: {
    titulo: "Declaração de habitualidade emitida pelo clube",
    passos: [
      "Solicite a declaração ao seu clube de tiro atestando frequência mínima de treinos.",
      "Envie o PDF assinado pelo clube (carimbo/assinatura do responsável).",
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Perguntas condicionais (o cliente responde no Hub, não é upload)
  // ────────────────────────────────────────────────────────────────────────
  pergunta_ainda_reside_imovel: {
    titulo: "Confirmação: você ainda reside neste imóvel?",
    passos: [
      "Abra o Hub e responda Sim ou Não.",
      "Se Sim, seguimos com o comprovante em nome de terceiro + documento do titular.",
      "Se Não, você será orientado a enviar um comprovante em seu nome.",
    ],
  },
  pergunta_comprovante_em_nome: {
    titulo: "Confirmação: o comprovante está no seu nome?",
    passos: [
      "Abra o Hub e responda Sim ou Não.",
      "Se Não, o sistema já pede a declaração do titular e o documento dele.",
    ],
  },
  pergunta_responde_inquerito_criminal: {
    titulo: "Confirmação: você responde a inquérito/processo criminal?",
    passos: [
      "Abra o Hub e responda Sim ou Não.",
      "Se Não, o sistema gera a declaração automaticamente para você assinar.",
    ],
  },
  renda_definir_condicao: {
    titulo: "Defina sua condição profissional",
    passos: [
      "Abra o Hub e escolha entre CLT, servidor público, autônomo/MEI, empresário ou aposentado.",
      "A partir da escolha, o sistema pede automaticamente os comprovantes certos.",
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Terceiros / imóvel
  // ────────────────────────────────────────────────────────────────────────
  documento_identificacao_terceiro: {
    titulo: "Documento de identidade do titular do comprovante",
    passos: [
      "Se o comprovante de residência está em nome de outra pessoa, envie um documento oficial dela (RG/CNH/CIN).",
      "Frente e verso, legível, dentro da validade.",
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Empresa / renda (variantes específicas do checklist)
  // ────────────────────────────────────────────────────────────────────────
  renda_nf_empresa: {
    titulo: "Nota fiscal emitida pela sua empresa",
    passos: [
      "Envie uma NF emitida pela empresa para um cliente nos últimos meses.",
      "Serve como comprovação de atividade e faturamento.",
    ],
  },
  renda_qsa: {
    titulo: "QSA — Quadro de Sócios e Administradores",
    passos: [
      "Emita o QSA no site da Receita Federal (últimos 30 dias) e envie o PDF.",
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Certidões — variantes do catálogo do checklist
  // ────────────────────────────────────────────────────────────────────────
  certidao_antecedentes_criminais_eleitoral: {
    titulo: "Antecedentes criminais — Justiça Eleitoral (TSE)",
    passos: [
      "Emita a certidão no site do TSE e envie o PDF original.",
    ],
  },
  certidao_antecedentes_criminais_estadual: {
    titulo: "Antecedentes criminais — Justiça Estadual",
    passos: [
      "Emita a certidão no portal do Tribunal de Justiça do seu estado.",
      "Envie o PDF original assinado digitalmente.",
    ],
  },
  certidao_antecedentes_criminais_federal: {
    titulo: "Antecedentes criminais — Justiça Federal",
    passos: [
      "Emita a certidão no portal da Justiça Federal da sua região.",
      "Envie o PDF exatamente como baixado.",
    ],
  },
  certidao_antecedentes_criminais_militar: {
    titulo: "Antecedentes criminais — Justiça Militar",
    passos: [
      "Emita a certidão no STM (federal) ou TJM-SP (estadual), conforme solicitado.",
      "Envie o PDF original.",
    ],
  },
  certidao_antecedentes_policia_civil_sp: {
    titulo: "Antecedentes — Polícia Civil/SP",
    passos: [
      "Emita a certidão no site da Polícia Civil de São Paulo.",
      "Envie o PDF original — o sistema valida a assinatura digital.",
    ],
  },
  certidao_crimes_eleitorais_tse: {
    titulo: "Crimes eleitorais — TSE",
    passos: [
      "Emita a certidão no site do TSE.",
      "Envie o PDF original assinado.",
    ],
  },
  certidao_crimes_militares_stm: {
    titulo: "Crimes militares — STM",
    passos: [
      "Emita a certidão no portal do Superior Tribunal Militar (STM).",
      "Envie o PDF original.",
    ],
  },
  certidao_criminal_tjmsp: {
    titulo: "Certidão criminal — TJM-SP",
    passos: [
      "Emita a certidão no portal do Tribunal de Justiça Militar de SP (TJM-SP).",
      "Envie o PDF original.",
    ],
  },
  certidao_estadual_distribuicao_acoes_criminais: {
    titulo: "Estadual — Distribuição de ações criminais",
    passos: [
      "Emita no portal do Tribunal de Justiça a certidão de distribuição criminal.",
      "Não envie a de execuções — são certidões distintas.",
    ],
  },
  certidao_estadual_execucoes_criminais: {
    titulo: "Estadual — Execuções criminais",
    passos: [
      "Emita no portal do Tribunal de Justiça a certidão de execuções criminais.",
      "Não envie a de distribuição — são certidões distintas.",
    ],
  },
  certidao_estadual_segundo_grau_acoes_criminais: {
    titulo: "Estadual — Segundo grau, ações criminais",
    passos: [
      "Emita a certidão de segundo grau (Tribunal) para ações criminais.",
    ],
  },
  certidao_estadual_segundo_grau_execucoes_criminais: {
    titulo: "Estadual — Segundo grau, execuções criminais",
    passos: [
      "Emita a certidão de segundo grau (Tribunal) para execuções criminais.",
    ],
  },
  certidao_federal_trf3_regional: {
    titulo: "TRF3 — Regional",
    passos: [
      "Emita no portal do TRF3 a certidão regional (abrangência de todo o TRF3).",
      "Envie o PDF original assinado.",
    ],
  },
  certidao_federal_trf3_sjsp_jef: {
    titulo: "TRF3 — SJSP / JEF",
    passos: [
      "No portal do TRF3, emita a certidão da Seção Judiciária de SP (SJSP) e do JEF.",
      "Envie o PDF original assinado.",
    ],
  },
  certidao_tjsp_distribuicao_criminal: {
    titulo: "TJSP — Distribuição criminal",
    passos: [
      "No portal do TJSP, emita a certidão de distribuição criminal.",
    ],
  },
  certidao_tjsp_execucoes_criminais: {
    titulo: "TJSP — Execuções criminais",
    passos: [
      "No portal do TJSP, emita a certidão de execuções criminais.",
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // Endereço por ano (comprovante_endereco_ano_XXXX)
  // ────────────────────────────────────────────────────────────────────────
  comprovante_endereco_ano_2022: {
    titulo: "Comprovante de endereço — Ano 2022",
    passos: [
      "Envie uma conta (luz, água, gás, internet, telefone) emitida em 2022.",
      "O documento comprova o histórico de residência exigido pela PF.",
    ],
  },
  comprovante_endereco_ano_2023: {
    titulo: "Comprovante de endereço — Ano 2023",
    passos: [
      "Envie uma conta (luz, água, gás, internet, telefone) emitida em 2023.",
    ],
  },
  comprovante_endereco_ano_2024: {
    titulo: "Comprovante de endereço — Ano 2024",
    passos: [
      "Envie uma conta (luz, água, gás, internet, telefone) emitida em 2024.",
    ],
  },
  comprovante_endereco_ano_2025: {
    titulo: "Comprovante de endereço — Ano 2025",
    passos: [
      "Envie uma conta (luz, água, gás, internet, telefone) emitida em 2025.",
    ],
  },
  comprovante_endereco_ano_2026: {
    titulo: "Comprovante de endereço — Ano 2026",
    passos: [
      "Envie uma conta (luz, água, gás, internet, telefone) emitida em 2026.",
      "Deve ser recente — preferencialmente do mês atual.",
    ],
  },
  comprovante_endereco_ano_2027: {
    titulo: "Comprovante de endereço — Ano 2027",
    passos: [
      "Envie uma conta recente (luz, água, gás, internet, telefone) emitida em 2027.",
    ],
  },
  comprovante_filiacao_entidade_tiro: {
    titulo: "Comprovante de filiação ativa ao clube/entidade de tiro",
    passos: [
      "Envie a carteirinha, contrato ou declaração do clube atestando filiação vigente.",
      "Deve estar dentro do prazo de validade.",
    ],
  },

  // Identidade
  cin: {
    titulo: "Documento oficial de identidade",
    passos: [
      "Envie um documento oficial com foto, CPF e data de nascimento (CIN, RG com CPF ou CNH).",
      "O arquivo deve estar legível, colorido e mostrar frente e verso.",
    ],
    observacao: "Aceita-se PDF ou foto nítida do documento original.",
  },
  rg_com_cpf: {
    titulo: "RG com CPF (ou CIN)",
    passos: [
      "Envie o RG com CPF impresso (frente e verso) ou a nova CIN.",
      "O documento deve estar dentro da validade e sem cortes.",
    ],
  },
  cnh: {
    titulo: "CNH válida",
    passos: [
      "Envie a CNH dentro do prazo de validade, frente e verso.",
      "Aceita-se a CNH digital exportada em PDF pelo aplicativo oficial.",
    ],
  },
  cpf: {
    titulo: "Comprovante de CPF",
    passos: [
      "Envie o comprovante de situação cadastral emitido no site da Receita Federal.",
    ],
  },

  // Endereço
  comprovante_residencia: {
    titulo: "Comprovante de residência atual",
    passos: [
      "Envie conta de luz, água, gás, internet ou telefone em seu nome.",
      "A emissão deve ser recente — o sistema aceita contas emitidas há até 30 dias.",
    ],
    observacao: "Se a conta não estiver no seu nome, envie também uma declaração do titular.",
  },
  declaracao_responsavel_imovel: {
    titulo: "Declaração do titular do imóvel",
    passos: [
      "Se a conta de residência não está no seu nome, o titular precisa assinar uma declaração.",
      "Envie o modelo assinado (fisicamente ou via Gov.br) junto com o documento do titular.",
    ],
  },

  // Antecedentes
  antecedentes_criminais: {
    titulo: "Antecedentes criminais — Polícia Civil",
    passos: [
      "Acesse o site da Polícia Civil do seu estado e emita a certidão de antecedentes.",
      "Envie o PDF original — não altere o arquivo, o sistema valida a assinatura digital.",
    ],
  },
  antecedentes_federal: {
    titulo: "Antecedentes federais — Justiça Federal",
    passos: [
      "Emita a certidão no portal da Justiça Federal da sua região.",
      "Envie o PDF exatamente como baixado — o sistema confere a autenticidade.",
    ],
  },
  antecedentes_federal_trf3_regional: {
    titulo: "Certidão TRF3 — Regional",
    passos: [
      "Acesse o portal do TRF3 e emita a certidão regional (abrangência de todo o TRF3).",
      "Envie o PDF original assinado.",
    ],
  },
  antecedentes_federal_sjsp_jef: {
    titulo: "Certidão SJSP / JEF",
    passos: [
      "No portal do TRF3, emita a certidão da Seção Judiciária de São Paulo (SJSP) e do JEF.",
      "Envie o PDF original assinado.",
    ],
  },
  antecedentes_estadual: {
    titulo: "Antecedentes estaduais",
    passos: [
      "Emita a certidão no portal do Tribunal de Justiça do seu estado.",
      "Envie o PDF original.",
    ],
  },
  antecedentes_estadual_distribuicao: {
    titulo: "TJSP — Distribuição criminal",
    passos: [
      "No portal do TJSP, emita a certidão de distribuição criminal.",
      "Não envie a de execuções — são certidões diferentes.",
    ],
  },
  antecedentes_estadual_execucoes: {
    titulo: "TJSP — Execuções criminais",
    passos: [
      "No portal do TJSP, emita a certidão de execuções criminais.",
      "Não envie a de distribuição — são certidões diferentes.",
    ],
  },
  antecedentes_militar: {
    titulo: "Justiça Militar",
    passos: [
      "Emita a certidão no portal do STM (federal) ou do TJM-SP (estadual), conforme solicitado.",
      "Envie o PDF original.",
    ],
  },
  antecedentes_eleitoral: {
    titulo: "Crimes eleitorais — TSE",
    passos: [
      "Emita a certidão de quitação e crimes eleitorais no site do TSE.",
      "Envie o PDF original assinado.",
    ],
  },

  // Renda
  renda_holerite_mes_atual: {
    titulo: "Holerite atual",
    passos: [
      "Envie o holerite do mês vigente ou do mês anterior.",
      "Deve conter nome, CPF, empresa e valor líquido.",
    ],
  },
  renda_holerite_funcionario_publico: {
    titulo: "Contracheque — servidor público",
    passos: [
      "Envie o contracheque atualizado emitido pelo sistema do órgão.",
    ],
  },
  renda_cartao_cnpj: {
    titulo: "Cartão CNPJ",
    passos: [
      "Emita o cartão CNPJ no site da Receita Federal e envie o PDF.",
    ],
  },
  renda_cnpj_autonomo: {
    titulo: "Comprovante de atividade autônoma",
    passos: [
      "Envie o CCMEI (MEI) ou contrato de prestação de serviço vigente.",
    ],
  },
  renda_contrato_social: {
    titulo: "Contrato social",
    passos: [
      "Envie o contrato social vigente da empresa, com todas as alterações registradas.",
    ],
  },
  renda_nf_recente: {
    titulo: "Notas fiscais recentes",
    passos: [
      "Envie as notas fiscais dos últimos meses que comprovem faturamento recorrente.",
    ],
  },
  renda_comprovante_beneficio: {
    titulo: "Comprovante de benefício",
    passos: [
      "Envie o extrato oficial do benefício (INSS, aposentadoria, pensão) do mês atual.",
    ],
  },
  renda_extrato_inss: {
    titulo: "Extrato do INSS",
    passos: [
      "Acesse Meu INSS e emita o extrato do benefício atual em PDF.",
    ],
  },

  // Laudos
  laudo_psicologico: {
    titulo: "Laudo psicológico — profissional credenciado PF",
    passos: [
      "Agende o exame com um psicólogo credenciado pela Polícia Federal.",
      "O laudo deve conter QR Code ou assinatura digital do credenciado.",
    ],
    observacao: "Se ainda não escolheu um credenciado, use o botão de busca para ver profissionais próximos.",
  },
  laudo_capacidade_tecnica: {
    titulo: "Laudo de capacidade técnica — instrutor credenciado PF",
    passos: [
      "Agende o teste com um instrutor de tiro credenciado pela Polícia Federal.",
      "O laudo deve estar assinado digitalmente pelo instrutor.",
    ],
  },

  // Clube / habitualidade
  comprovante_clube_tiro: {
    titulo: "Comprovante de filiação a clube de tiro",
    passos: [
      "Envie o comprovante da sua filiação vigente ao clube de tiro (carteirinha, contrato ou declaração).",
    ],
  },
  comprovante_habitualidade: {
    titulo: "Comprovante de habitualidade",
    passos: [
      "Envie a declaração do clube atestando frequência mínima de treinos no período exigido.",
    ],
  },
  comprovante_competicao: {
    titulo: "Comprovante de competição",
    passos: [
      "Envie o boletim/resultado oficial da competição em que participou.",
    ],
  },

  // Efetiva necessidade / correlatos
  comprovante_efetiva_necessidade: {
    titulo: "Comprovante de efetiva necessidade",
    passos: [
      "Envie os documentos que comprovam a exposição ao risco justificando a posse/porte.",
    ],
  },
  documento_complementar_caso: {
    titulo: "Documento complementar do caso",
    passos: [
      "Envie o documento adicional solicitado pela equipe para este processo específico.",
    ],
  },
  declaracao_correlata: {
    titulo: "Declaração correlata",
    passos: [
      "Envie o modelo assinado da declaração correlata solicitada.",
    ],
  },
  declaracao_guarda_responsavel: {
    titulo: "Declaração de guarda responsável",
    passos: [
      "Envie a declaração assinada de que a arma será guardada em local seguro, longe de menores e incapazes.",
    ],
  },
  declaracao_guarda_acervo_1endereco: {
    titulo: "Declaração — acervo em um único endereço",
    passos: [
      "Envie a declaração assinada informando que todo o acervo está guardado no endereço cadastrado.",
    ],
  },
  declaracao_sem_inquerito_processo_criminal: {
    titulo: "Declaração — sem inquérito/processo criminal",
    passos: [
      "Envie a declaração assinada de que não responde a inquérito nem processo criminal.",
    ],
  },

  // Processo administrativo
  protocolo_processo: {
    titulo: "Protocolo do processo",
    passos: [
      "Envie o comprovante de protocolo gerado pelo órgão (PF ou Exército).",
    ],
  },
  oficio: {
    titulo: "Ofício",
    passos: [
      "Envie o ofício recebido do órgão para registrarmos e continuar a análise.",
    ],
  },
  despacho: {
    titulo: "Despacho",
    passos: [
      "Envie o despacho recebido do órgão para registrarmos e continuar a análise.",
    ],
  },
  exigencia: {
    titulo: "Exigência do órgão",
    passos: [
      "Envie o documento de exigência recebido do órgão para respondermos dentro do prazo.",
    ],
  },

  // Armas
  cr: {
    titulo: "Certificado de Registro (CR) — CAC",
    passos: [
      "Envie o CR atual emitido pelo Exército, dentro da validade.",
    ],
  },
  craf: {
    titulo: "CRAF / SIGMA",
    passos: [
      "Envie o CRAF/SIGMA emitido pelo Exército referente à arma.",
    ],
  },
  sinarm: {
    titulo: "SINARM",
    passos: [
      "Envie o registro SINARM emitido pela Polícia Federal referente à arma.",
    ],
  },
  gt: {
    titulo: "Guia de Tráfego (GT)",
    passos: [
      "Envie a GT emitida pelo Exército.",
    ],
  },
  gte: {
    titulo: "Guia de Tráfego Eventual (GTE)",
    passos: [
      "Envie a GTE emitida pelo Exército.",
    ],
  },
  autorizacao_compra: {
    titulo: "Autorização de compra",
    passos: [
      "Envie a autorização de compra deferida pela Polícia Federal ou pelo Exército.",
    ],
  },
  nota_fiscal_arma: {
    titulo: "Nota fiscal da arma",
    passos: [
      "Envie a nota fiscal emitida pela loja/importadora da arma.",
    ],
  },

  // Jurídicos assinados
  contrato_assinado: {
    titulo: "Contrato de adesão assinado (Gov.br)",
    passos: [
      "Baixe o contrato, assine com sua conta Gov.br (ou certificado ICP-Brasil) e envie o PDF assinado aqui.",
      "A IA valida a assinatura antes de liberar a próxima etapa.",
    ],
  },
  procuracao_assinada: {
    titulo: "Procuração assinada (Gov.br)",
    passos: [
      "Baixe a procuração, assine com Gov.br (ou ICP-Brasil) e envie o PDF assinado.",
      "A IA confere a assinatura antes de destravar o processo.",
    ],
  },
  procuracao: {
    titulo: "Procuração",
    passos: [
      "Envie a procuração assinada digitalmente (Gov.br ou ICP-Brasil).",
    ],
  },

  outro: {
    titulo: "Documento adicional",
    passos: [
      "Envie o documento solicitado no formato original (PDF ou foto legível).",
    ],
  },
};

export function getExplicacaoPendencia(
  rawTipo: string,
  fallbackNome?: string | null,
  hubTipoFallback?: string | null,
): ExplicacaoPendencia {
  const primary = String(rawTipo || "").trim().toLowerCase();
  const secondary = String(hubTipoFallback || "").trim().toLowerCase();
  const hit = REGISTRO[primary] || (secondary ? REGISTRO[secondary] : undefined);
  if (hit) return hit;
  const titulo = fallbackNome && fallbackNome.trim()
    ? fallbackNome.trim()
    : "Documento solicitado";
  return {
    titulo,
    passos: [
      "Envie o documento solicitado no formato original (PDF ou foto legível).",
      "A IA valida integridade e assinatura antes de aprovar.",
    ],
    observacao: "Se ficar em dúvida, abra o Hub Documental — a IA orienta o formato correto antes do envio.",
  };
}
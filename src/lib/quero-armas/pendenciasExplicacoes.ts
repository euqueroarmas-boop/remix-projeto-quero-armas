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
  hubTipo: string,
  fallbackNome?: string | null,
): ExplicacaoPendencia {
  const key = String(hubTipo || "").trim().toLowerCase();
  const hit = REGISTRO[key];
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
  };
}
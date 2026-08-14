/**
 * NOME CANÔNICO DO DOCUMENTO no runtime Deno + a frase de "como resolver".
 *
 * Espelho de src/lib/quero-armas/documentosHubCatalogo.ts
 * (`NOME_CANONICO_ANTECEDENTES` e os rótulos do catálogo). O e-mail tem que
 * chamar o documento exatamente como o Hub Documental chama — foi a divergência
 * entre esses nomes que fez o mesmo documento aparecer com dois títulos.
 *
 * A frase de "como resolver" é o que torna o alerta ÚTIL: não basta dizer que
 * vence, tem que dizer onde emitir a via nova. Ela varia por tipo e, no
 * comprovante de endereço, pela concessionária que a IA leu do PDF.
 */

export const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  rg_com_cpf: "Cédula de Identidade (RG) com CPF",
  rg: "Cédula de Identidade (RG) com CPF",
  cin: "Carteira de Identidade Nacional (CIN)",
  cnh: "Carteira Nacional de Habilitação (CNH)",
  cpf: "Cadastro de Pessoas Físicas (CPF)",
  foto_3x4: "Foto 3x4 do requerente",
  certidao_alteracao_nome: "Certidão averbada de alteração de nome",
  comprovante_residencia: "Comprovante de residência",
  comprovante_endereco: "Comprovante de residência",
  declaracao_responsavel_imovel: "Declaração do responsável pelo imóvel",
  ctps: "Carteira de Trabalho (CTPS)",
  renda_holerite_mes_atual: "Demonstrativo de Pagamento — Contracheque",
  renda_holerite_funcionario_publico: "Demonstrativo de Pagamento — Contracheque (servidor público)",
  renda_carteira_funcional: "Identidade Funcional",
  renda_cartao_cnpj: "Comprovante de Inscrição e de Situação Cadastral do CNPJ",
  renda_qsa: "QSA — Quadro de Sócios e Administradores",
  renda_contrato_social: "Contrato Social / Requerimento de Empresário",
  renda_ficha_cadastral_jucesp: "Ficha Cadastral Completa (Junta Comercial)",
  renda_ccmei: "CCMEI — Certificado da Condição de MEI",
  renda_cnpj_autonomo: "Cartão CNPJ (autônomo / MEI)",
  renda_nf_empresa: "Nota Fiscal da Empresa",
  renda_comprovante_beneficio: "Comprovante de benefício",
  renda_extrato_inss: "Extrato INSS",
  // Certidões — padrão canônico "Certidão <espécie> — <órgão>".
  antecedentes_criminais: "Certidão de Antecedentes Criminais — Polícia Civil/SP (IIRGD)",
  antecedentes_federal: "Certidão de Distribuição Criminal — Justiça Federal",
  antecedentes_estadual: "Certidão Estadual Criminal — TJSP",
  antecedentes_federal_trf3_regional:
    "Certidão de Distribuição Criminal — Tribunal Regional Federal da 3ª Região",
  antecedentes_federal_sjsp_jef:
    "Certidão de Distribuição Criminal — Seção Judiciária de São Paulo e JEF/SP",
  antecedentes_estadual_distribuicao: "Certidão Estadual de Distribuições Criminais — TJSP",
  antecedentes_estadual_execucoes: "Certidão Estadual de Execuções Criminais — TJSP",
  antecedentes_militar: "Certidão Negativa de Crimes Militares — Justiça Militar da União (STM)",
  antecedentes_militar_estadual: "Certidão de Antecedentes Criminais — Justiça Militar Estadual (TJM)",
  antecedentes_eleitoral: "Certidão de Crimes Eleitorais — TSE",
  declaracao_sem_inquerito_processo_criminal: "Declaração de não responder a inquérito/processo",
  declaracao_guarda_responsavel: "Declaração de guarda responsável",
  declaracao_correlata: "Declaração correlata",
  declaracao_homonimia: "Declaração de homonímia",
  laudo_psicologico: "Laudo de Avaliação Psicológica para Aquisição/Porte de Arma de Fogo",
  laudo_capacidade_tecnica: "Atestado de Capacidade Técnica para Manuseio de Arma de Fogo",
  comprovante_efetiva_necessidade: "Comprovação de efetiva necessidade",
  boletim_ocorrencia: "Boletim de Ocorrência",
  documento_complementar_caso: "Documento complementar do caso",
  cr: "CR — Certificado de Registro",
  craf: "CRAF — Certificado de Registro de Arma de Fogo",
  sinarm: "SINARM — Certificado de Registro de Arma de Fogo",
  gt: "GT — Guia de Tráfego",
  gte: "GTE — Guia de Tráfego Eventual",
  autorizacao_compra: "Autorização de compra",
  nota_fiscal_arma: "Nota fiscal da arma",
  comprovante_habitualidade: "Comprovante de habitualidade",
  comprovante_clube_tiro: "Comprovante de clube / entidade",
  comprovante_competicao: "Comprovante de competição / atividade",
  comprovante_pagamento: "Comprovante de pagamento",
  gru: "GRU — Guia de Recolhimento da União",
  protocolo_processo: "Protocolo do processo",
  oficio: "Ofício",
  despacho: "Despacho / movimentação",
  exigencia: "Exigência administrativa",
  indeferimento: "Indeferimento",
  procuracao: "Procuração",
  procuracao_assinada: "Procuração assinada",
  contrato_assinado: "Contrato assinado",
  recurso_administrativo_doc: "Recurso administrativo",
  mandado_seguranca_doc: "Mandado de segurança / peça jurídica",
  outro: "Documento complementar",
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Concessionárias reconhecidas no comprovante de endereço. */
const CONTA_LABEL: Record<string, string> = {
  energia: "conta de energia elétrica",
  agua: "conta de água",
  gas: "conta de gás",
  internet: "conta de internet fixa",
  telefone_fixo: "conta de telefone fixo",
  iptu: "guia de IPTU",
};

// deno-lint-ignore no-explicit-any
function camposIA(doc: any): Record<string, unknown> {
  const ia = doc?.ia_dados_extraidos;
  return (ia?.camposExtraidos || ia?.campos_extraidos || ia?.campos || {}) as Record<string, unknown>;
}

/**
 * Nome do documento como o cliente vê no Hub. Prioriza o rótulo canônico do
 * tipo; só usa o título lido pela IA quando o tipo é desconhecido.
 */
// deno-lint-ignore no-explicit-any
export function nomeDocumentoCanonico(doc: any, fallback = "Documento"): string {
  const tipo = norm(doc?.tipo_documento);
  const canonico = TIPO_DOCUMENTO_LABELS[tipo];
  if (canonico) {
    // Comprovante de endereço ganha a concessionária, que é o que o cliente
    // reconhece: "Comprovante de residência — EDP".
    if (tipo === "comprovante_residencia" || tipo === "comprovante_endereco") {
      const c = camposIA(doc);
      const empresa = String(c.empresa_emissora ?? doc?.orgao_emissor ?? "").trim();
      if (empresa) return `${canonico} — ${empresa}`;
    }
    return canonico;
  }
  const explicito = String(doc?.nome_documento ?? "").trim();
  return explicito || fallback;
}

/**
 * O que o cliente precisa fazer para resolver — a frase muda com o documento.
 * É isto que separa um alerta acionável de um aviso genérico.
 */
// deno-lint-ignore no-explicit-any
export function comoResolverDocumento(doc: any): string {
  const tipo = norm(doc?.tipo_documento);

  if (tipo === "comprovante_residencia" || tipo === "comprovante_endereco") {
    const c = camposIA(doc);
    const empresa = String(c.empresa_emissora ?? doc?.orgao_emissor ?? "").trim();
    const conta = CONTA_LABEL[norm(c.tipo_conta)] ?? null;
    if (conta === "guia de IPTU") return "Emita a guia atualizada no site da prefeitura.";
    if (empresa) return `Baixe a via atualizada no site da concessionária (${empresa}).`;
    return "Baixe a via atualizada no site da sua concessionária.";
  }

  if (tipo.startsWith("antecedentes_")) {
    const ORGAO: Record<string, string> = {
      antecedentes_criminais: "Polícia Civil",
      antecedentes_estadual: "TJSP",
      antecedentes_estadual_distribuicao: "TJSP (e-SAJ)",
      antecedentes_estadual_execucoes: "TJSP (e-SAJ)",
      antecedentes_federal: "Justiça Federal",
      antecedentes_federal_trf3_regional: "TRF3",
      antecedentes_federal_sjsp_jef: "TRF3",
      antecedentes_militar: "STM",
      antecedentes_militar_estadual: "TJM",
      antecedentes_eleitoral: "TSE",
    };
    const orgao = ORGAO[tipo];
    return orgao
      ? `Emita a nova certidão no portal do ${orgao}.`
      : "Emita a nova certidão no portal do órgão emissor.";
  }

  if (tipo.includes("laudo") || tipo.includes("psicolog") || tipo.includes("capacidade_tecnica")) {
    return "Agende a reavaliação agora; laudo leva alguns dias para ficar pronto.";
  }

  if (tipo.startsWith("renda_") || tipo === "ctps") {
    return "Envie o comprovante do mês corrente — a Polícia Federal não aceita mês anterior.";
  }

  if (tipo === "cr" || tipo === "craf" || tipo === "sinarm" || tipo === "gt" || tipo === "gte") {
    return "Abra a renovação com a nossa equipe pelo Arsenal.";
  }

  if (tipo.includes("autoriza") || tipo.includes("aquisi")) {
    return "Autorização vencida exige novo pedido à autoridade que a emitiu. Fale com a gente hoje.";
  }

  if (tipo === "procuracao" || tipo.startsWith("procuracao_")) {
    return "Assine a nova procuração no Gov.br — sem ela válida não podemos atuar no seu processo.";
  }

  return "Envie a via atualizada pelo Arsenal.";
}

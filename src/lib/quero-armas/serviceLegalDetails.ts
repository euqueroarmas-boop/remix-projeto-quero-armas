/**
 * Detalhes legais/operacionais por slug de serviço.
 *
 * Fonte: catálogo público (qa_servicos_catalogo) + base normativa abaixo.
 * Esta camada é APENAS apresentação institucional, sem promessa de deferimento.
 *
 * Base normativa de referência (não exaustiva):
 *  - Lei nº 10.826/2003 (Estatuto do Desarmamento)
 *  - Decreto nº 11.615/2023 e alterações posteriores
 *  - Normativos da Polícia Federal sobre SINARM (IN nº 201/2021-DG/PF e atualizações)
 *  - Normas do Exército/COLOG/DFPC sobre SIGMA (CAC, CR, CRAF, GTE, apostilamento, acervo)
 */

export type CategoriaOrgao =
  | "PF_SINARM"
  | "EXERCITO_SIGMA"
  | "PF_SINARM_E_EXERCITO_SIGMA"
  | "JUDICIAL"
  | "TREINAMENTO"
  | "INTERNO";

export interface ServiceLegalDetails {
  titulo: string;
  orgao: CategoriaOrgao;
  orgaoLabel: string;
  natureza: string;
  fundamento: string[];
  requisitos: string[];
  documentos: string[];
  etapas: string[];
  prazoEstimado: string;
  observacoes: string[];
}

const FUND_SINARM = [
  "Lei nº 10.826/2003 — Estatuto do Desarmamento",
  "Decreto nº 11.615/2023 e alterações posteriores",
  "IN nº 201/2021-DG/PF e atos normativos da Polícia Federal sobre o SINARM",
];

const FUND_SIGMA = [
  "Lei nº 10.826/2003 — Estatuto do Desarmamento",
  "Decreto nº 11.615/2023 e alterações posteriores",
  "Normas do Exército Brasileiro / COLOG / DFPC aplicáveis ao SIGMA (CAC, CR, CRAF, GTE, acervo)",
];

const FUND_AMBOS = [
  "Lei nº 10.826/2003 — Estatuto do Desarmamento",
  "Decreto nº 11.615/2023 e alterações posteriores",
  "IN nº 201/2021-DG/PF (SINARM) e normas do Exército/COLOG/DFPC (SIGMA)",
];

const OBS_PADRAO = [
  "Requisitos, documentos e prazos podem variar conforme o órgão competente, a categoria do interessado, o acervo declarado e a norma vigente na data do protocolo.",
  "A Quero Armas atua como assessoria técnica e documental especializada e não substitui a decisão do órgão competente.",
  "Não há qualquer promessa de deferimento; os prazos informados são estimativas operacionais com base em casos similares.",
];

const OBS_JUDICIAL = [
  "A Quero Armas não exerce advocacia. Eventual atuação judicial (mandado de segurança, ação ordinária, recurso) depende de advogado parceiro, com contrato apartado e procuração específica.",
  "Este serviço é informativo/preparatório e não constitui aconselhamento jurídico individual.",
];

/** Detalhes específicos por slug. Slugs ausentes recebem fallback por categoria. */
const DETAILS: Record<string, ServiceLegalDetails> = {
  // ============ PF / SINARM ============
  "posse-de-arma-de-fogo": {
    titulo: "Posse de Arma de Fogo",
    orgao: "PF_SINARM",
    orgaoLabel: "Polícia Federal — SINARM",
    natureza:
      "Autorização para manter arma de fogo de uso permitido no interior da residência ou local de trabalho, mediante registro no SINARM.",
    fundamento: FUND_SINARM,
    requisitos: [
      "Idade mínima de 25 anos",
      "Comprovação de ocupação lícita e residência fixa",
      "Capacidade técnica e aptidão psicológica em vigor",
      "Ausência de antecedentes criminais",
    ],
    documentos: [
      "Documento de identidade (RG/CIN/CNH frente e verso)",
      "CPF",
      "Comprovante de residência atualizado",
      "Comprovante de ocupação lícita",
      "Laudo de aptidão psicológica (psicólogo credenciado PF)",
      "Atestado de capacidade técnica (instrutor credenciado PF)",
      "Certidões negativas (Justiça Estadual, Federal, Militar e Eleitoral)",
    ],
    etapas: [
      "Cadastro e envio de documentos",
      "Análise técnica e checklist pela equipe Quero Armas",
      "Protocolo no SINARM/Polícia Federal",
      "Acompanhamento até decisão da PF",
    ],
    prazoEstimado: "Estimativa operacional: 30 a 120 dias após protocolo, conforme análise da PF.",
    observacoes: OBS_PADRAO,
  },

  "porte-arma-fogo": {
    titulo: "Porte de Arma de Fogo",
    orgao: "PF_SINARM",
    orgaoLabel: "Polícia Federal — SINARM",
    natureza:
      "Autorização excepcional para portar arma de fogo fora da residência ou local de trabalho, condicionada a comprovação de efetiva necessidade.",
    fundamento: FUND_SINARM,
    requisitos: [
      "Idade mínima de 25 anos",
      "Demonstração de efetiva necessidade (risco concreto à integridade física)",
      "Capacidade técnica e aptidão psicológica vigentes",
      "Ausência de antecedentes criminais e ocupação lícita comprovada",
    ],
    documentos: [
      "Documento de identidade e CPF",
      "Comprovante de residência atualizado",
      "Comprovação documental da necessidade alegada",
      "Laudo psicológico e atestado de capacidade técnica vigentes",
      "Certidões negativas criminais",
    ],
    etapas: [
      "Cadastro e envio de documentos",
      "Construção da fundamentação de efetiva necessidade",
      "Protocolo junto à Polícia Federal",
      "Acompanhamento até decisão final",
    ],
    prazoEstimado: "Estimativa operacional: 60 a 180 dias após protocolo, conforme análise da PF.",
    observacoes: OBS_PADRAO,
  },

  "autorizacao-compra-arma-fogo": {
    titulo: "Autorização de Compra de Arma de Fogo",
    orgao: "PF_SINARM",
    orgaoLabel: "Polícia Federal — SINARM",
    natureza:
      "Serviço de autorização de compra de arma de fogo para atiradores desportivos junto ao SINARM/Polícia Federal.",
    fundamento: FUND_SINARM,
    requisitos: [
      "Posse ou CR vigente conforme o caso",
      "Acervo dentro dos limites legais para a categoria",
      "Documentação pessoal regular",
    ],
    documentos: [
      "Documento de identidade e CPF",
      "Comprovante de residência atualizado",
      "CR/Posse vigente quando aplicável",
      "Dados da arma pretendida (modelo, calibre, fabricante)",
    ],
    etapas: [
      "Cadastro e envio de documentos",
      "Conferência de acervo e elegibilidade",
      "Protocolo da autorização junto à PF",
      "Acompanhamento até emissão da autorização",
    ],
    prazoEstimado: "Estimativa operacional: 15 a 60 dias após protocolo.",
    observacoes: OBS_PADRAO,
  },

  "registro-arma-sinarm": {
    titulo: "Registro de Arma no SINARM",
    orgao: "PF_SINARM",
    orgaoLabel: "Polícia Federal — SINARM",
    natureza: "Registro de arma de fogo de uso permitido junto ao SINARM/PF.",
    fundamento: FUND_SINARM,
    requisitos: ["Posse vigente", "Nota fiscal e dados completos da arma"],
    documentos: [
      "Documento de identidade e CPF",
      "Comprovante de residência",
      "Nota fiscal da arma",
      "Posse vigente",
    ],
    etapas: [
      "Cadastro e envio de documentos",
      "Conferência técnica",
      "Protocolo do registro na PF",
      "Entrega do CRAF/SINARM",
    ],
    prazoEstimado: "Estimativa operacional: 30 a 90 dias após protocolo.",
    observacoes: OBS_PADRAO,
  },

  // ============ EXÉRCITO / SIGMA ============
  "concessao-cr": {
    titulo: "Concessão de CR (Certificado de Registro)",
    orgao: "EXERCITO_SIGMA",
    orgaoLabel: "Exército Brasileiro — SIGMA",
    natureza:
      "Obtenção do Certificado de Registro (CR) junto ao Exército para atuar como Atirador, Caçador ou Colecionador (CAC).",
    fundamento: FUND_SIGMA,
    requisitos: [
      "Idade mínima conforme categoria",
      "Comprovação de habitualidade (quando aplicável)",
      "Filiação a entidade de tiro reconhecida (atirador desportivo)",
      "Aptidão psicológica e capacidade técnica vigentes",
      "Certidões negativas criminais",
    ],
    documentos: [
      "Documento de identidade e CPF",
      "Comprovante de residência",
      "Comprovante de filiação a clube/entidade (atirador)",
      "Laudo psicológico e atestado de capacidade técnica",
      "Certidões negativas (Justiça Estadual, Federal, Militar e Eleitoral)",
    ],
    etapas: [
      "Cadastro e envio de documentos",
      "Análise técnica e checklist",
      "Protocolo no SIGMA / Serviço de Fiscalização do Exército",
      "Acompanhamento até emissão do CR",
    ],
    prazoEstimado: "Estimativa operacional: 60 a 180 dias após protocolo.",
    observacoes: OBS_PADRAO,
  },

  "renovacao-cr": {
    titulo: "Renovação de CR",
    orgao: "EXERCITO_SIGMA",
    orgaoLabel: "Exército Brasileiro — SIGMA",
    natureza: "Renovação do Certificado de Registro CAC junto ao Exército/SIGMA.",
    fundamento: FUND_SIGMA,
    requisitos: [
      "CR ainda vigente ou dentro do prazo administrativo de renovação",
      "Comprovação de habitualidade (atirador)",
      "Aptidão psicológica e capacidade técnica vigentes",
      "Certidões negativas criminais",
    ],
    documentos: [
      "CR atual",
      "Documento de identidade e CPF",
      "Comprovante de residência",
      "Comprovante de habitualidade no clube",
      "Laudo psicológico e atestado de capacidade técnica vigentes",
      "Certidões negativas",
    ],
    etapas: [
      "Cadastro e envio de documentos",
      "Conferência técnica do acervo e da habitualidade",
      "Protocolo da renovação no SIGMA",
      "Acompanhamento até emissão do novo CR",
    ],
    prazoEstimado: "Estimativa operacional: 60 a 180 dias após protocolo.",
    observacoes: OBS_PADRAO,
  },

  "guia-de-trafego-especial-cac": {
    titulo: "Guia de Tráfego Especial (GTE) — CAC",
    orgao: "EXERCITO_SIGMA",
    orgaoLabel: "Exército Brasileiro — SIGMA",
    natureza:
      "Autorização do Exército para transporte de arma de fogo registrada no SIGMA entre origem e destino determinados.",
    fundamento: FUND_SIGMA,
    requisitos: [
      "CR vigente",
      "Arma regularmente registrada no SIGMA (CRAF)",
      "Justificativa de deslocamento (competição, treino, manutenção, mudança)",
    ],
    documentos: [
      "CR vigente",
      "CRAF da(s) arma(s)",
      "Documento de identidade e CPF",
      "Comprovante do evento/destino (quando aplicável)",
    ],
    etapas: [
      "Cadastro e envio de dados do trajeto",
      "Emissão técnica da GTE",
      "Protocolo no SIGMA",
      "Entrega da GTE para o cliente",
    ],
    prazoEstimado: "Estimativa operacional: 5 a 30 dias.",
    observacoes: OBS_PADRAO,
  },

  "apostilamento": {
    titulo: "Apostilamento de CR / CRAF",
    orgao: "EXERCITO_SIGMA",
    orgaoLabel: "Exército Brasileiro — SIGMA",
    natureza:
      "Atualização de dados cadastrais (endereço, acervo, qualificação) no CR e/ou CRAF junto ao Exército.",
    fundamento: FUND_SIGMA,
    requisitos: ["CR vigente", "Documentação que comprove a alteração pretendida"],
    documentos: [
      "CR atual",
      "Documento de identidade e CPF",
      "Comprovante atualizado do dado a ser apostilado",
    ],
    etapas: [
      "Cadastro e envio de documentos",
      "Conferência técnica",
      "Protocolo do apostilamento no SIGMA",
      "Entrega do CR/CRAF atualizado",
    ],
    prazoEstimado: "Estimativa operacional: 15 a 60 dias.",
    observacoes: OBS_PADRAO,
  },

  "registro-arma-sigma": {
    titulo: "Registro de Arma no SIGMA (CRAF)",
    orgao: "EXERCITO_SIGMA",
    orgaoLabel: "Exército Brasileiro — SIGMA",
    natureza:
      "Emissão do Certificado de Registro de Arma de Fogo (CRAF) para CAC, vinculado ao CR no SIGMA.",
    fundamento: FUND_SIGMA,
    requisitos: ["CR vigente", "Autorização de compra/transferência válida"],
    documentos: [
      "CR vigente",
      "Nota fiscal e dados completos da arma",
      "Documento de identidade e CPF",
    ],
    etapas: [
      "Cadastro e envio de documentos",
      "Conferência técnica",
      "Protocolo do registro no SIGMA",
      "Entrega do CRAF",
    ],
    prazoEstimado: "Estimativa operacional: 30 a 90 dias.",
    observacoes: OBS_PADRAO,
  },
};

/** Fallback genérico seguro por categoria — usado quando o slug não tem detalhe específico. */
function fallbackByCategoria(
  nome: string,
  categoria: string | null | undefined,
): ServiceLegalDetails {
  const c = (categoria || "").toLowerCase();

  if (c.includes("sinarm") || c.includes("polícia") || c.includes("policia") || c.includes("pf")) {
    return {
      titulo: nome,
      orgao: "PF_SINARM",
      orgaoLabel: "Polícia Federal — SINARM",
      natureza: "Serviço regulado pela Polícia Federal junto ao SINARM.",
      fundamento: FUND_SINARM,
      requisitos: ["Documentação pessoal regular", "Demais requisitos conforme a categoria do interessado"],
      documentos: ["Documento de identidade e CPF", "Comprovante de residência atualizado"],
      etapas: ["Cadastro e envio de documentos", "Análise técnica", "Protocolo na PF", "Acompanhamento"],
      prazoEstimado: "Prazo estimado operacionalmente conforme histórico da PF na sua unidade.",
      observacoes: OBS_PADRAO,
    };
  }

  if (c.includes("sigma") || c.includes("exército") || c.includes("exercito") || c.includes("eb")) {
    return {
      titulo: nome,
      orgao: "EXERCITO_SIGMA",
      orgaoLabel: "Exército Brasileiro — SIGMA",
      natureza: "Serviço regulado pelo Exército Brasileiro junto ao SIGMA.",
      fundamento: FUND_SIGMA,
      requisitos: ["CR vigente quando aplicável", "Demais requisitos conforme a categoria CAC"],
      documentos: ["Documento de identidade e CPF", "Comprovante de residência", "CR e CRAF quando aplicável"],
      etapas: ["Cadastro e envio de documentos", "Conferência técnica", "Protocolo no SIGMA", "Acompanhamento"],
      prazoEstimado: "Prazo estimado operacionalmente conforme histórico do SFPC/SIGMA.",
      observacoes: OBS_PADRAO,
    };
  }

  if (c.includes("curso") || c.includes("treinamento")) {
    return {
      titulo: nome,
      orgao: "TREINAMENTO",
      orgaoLabel: "Treinamento operacional / instrutor credenciado",
      natureza: "Curso/treinamento de tiro com instrutor credenciado.",
      fundamento: [
        "Lei nº 10.826/2003",
        "Normativos da PF/Exército sobre capacidade técnica e instrutores credenciados",
      ],
      requisitos: ["Idade mínima conforme curso", "Documentos pessoais regulares"],
      documentos: ["Documento de identidade e CPF"],
      etapas: ["Inscrição", "Aula teórica", "Aula prática no estande", "Emissão do atestado"],
      prazoEstimado: "Conforme calendário do estande/instrutor.",
      observacoes: OBS_PADRAO,
    };
  }

  if (c.includes("judic") || c.includes("recurso") || c.includes("mandado")) {
    return {
      titulo: nome,
      orgao: "JUDICIAL",
      orgaoLabel: "Via judicial (advogado parceiro)",
      natureza: "Serviço preparatório para atuação judicial via advogado parceiro.",
      fundamento: ["Constituição Federal", "Lei nº 10.826/2003", "Decreto nº 11.615/2023"],
      requisitos: ["Documentação da negativa/decisão impugnada", "Procuração específica para advogado parceiro"],
      documentos: ["Documento de identidade e CPF", "Cópia do indeferimento ou ato a ser impugnado"],
      etapas: [
        "Cadastro e análise documental",
        "Encaminhamento para advogado parceiro",
        "Contrato apartado de honorários",
        "Atuação processual pelo advogado",
      ],
      prazoEstimado: "Conforme o Judiciário; sem garantia de prazo legal.",
      observacoes: [...OBS_JUDICIAL, ...OBS_PADRAO],
    };
  }

  return {
    titulo: nome,
    orgao: "INTERNO",
    orgaoLabel: "Serviço interno / consultoria Quero Armas",
    natureza: "Serviço operacional/consultivo prestado pela Quero Armas.",
    fundamento: ["Lei nº 10.826/2003", "Decreto nº 11.615/2023"],
    requisitos: ["Documentação pessoal regular"],
    documentos: ["Documento de identidade e CPF"],
    etapas: ["Cadastro", "Atendimento técnico", "Entrega da consultoria"],
    prazoEstimado: "Conforme escopo contratado.",
    observacoes: OBS_PADRAO,
  };
}

export function getServiceLegalDetails(
  slug: string,
  fallback: { nome: string; categoria?: string | null },
): ServiceLegalDetails {
  const specific = DETAILS[slug];
  if (specific) return specific;
  return fallbackByCategoria(fallback.nome, fallback.categoria);
}
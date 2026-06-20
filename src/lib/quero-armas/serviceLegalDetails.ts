/**
 * Conteúdo técnico-editorial por serviço (slug) da Quero Armas.
 *
 * Regras:
 *  - Nenhum texto genérico repetido como corpo principal.
 *  - Cada slug tem conteúdo específico. Slug sem entrada => "em revisão".
 *  - Base normativa mínima: Lei 10.826/2003, Decreto 11.615/2023,
 *    Decreto 12.345/2024 e normativos PF/SINARM-CAC aplicáveis.
 *  - Não promete deferimento, prazo legal garantido ou resultado.
 */

import {
  QA_BASE_LEGAL_CURSO_E_MANUSEIO,
  QA_BASE_LEGAL_NUCLEO,
  QA_BASE_LEGAL_SINARM_CAC,
  QA_BASE_LEGAL_SINARM_DEFESA_PESSOAL,
} from "./legalBasis";

export type SistemaAplicavel =
  | "SINARM_PF"
  | "CAC_PF"
  | "JUDICIAL"
  | "CURSO_ESTANDE"
  | "INTERNO";

export interface ServiceLegalDetails {
  titulo: string;
  sistema: SistemaAplicavel;
  orgaoCompetente: string;
  baseLegal: string[];
  oQueE: string;
  quandoSeAplica: string;
  quemPodeSolicitar: string[];
  requisitos: string[];
  documentos: string[];
  etapas: string[];
  pontosAtencao: string[];
  limitesQA: string;
}

const DEFERIMENTO_NOTE =
  "O deferimento depende exclusivamente do órgão competente. A Quero Armas atua como assessoria técnica e documental e não influencia a decisão final.";

const ADV_NOTE =
  "Atividade privativa de advocacia (Lei nº 8.906/1994). Quando aplicável, a atuação judicial é realizada por advogado(a) habilitado(a), com contrato e procuração apartados.";

const DETAILS: Record<string, ServiceLegalDetails> = {
  // ───────────────────────── SINARM / PF ─────────────────────────

  "posse-de-arma-de-fogo": {
    titulo: "Aquisição / Posse de Arma de Fogo",
    sistema: "SINARM_PF",
    orgaoCompetente: "Polícia Federal — SINARM",
    baseLegal: [
      "Lei nº 10.826/2003, art. 4º a 6º (requisitos e posse)",
      ...QA_BASE_LEGAL_SINARM_DEFESA_PESSOAL,
    ],
    oQueE:
      "Autorização da Polícia Federal para adquirir e manter arma de fogo de uso permitido no interior da residência ou em dependência dela, ou no local de trabalho de propriedade do interessado.",
    quandoSeAplica:
      "Quando o cidadão deseja, pela primeira vez ou após indeferimento anterior, adquirir e manter arma de fogo de uso permitido no seu domicílio ou local de trabalho.",
    quemPodeSolicitar: [
      "Pessoa física com idade mínima de 25 anos",
      "Residente no território nacional",
      "Sem antecedentes criminais que vedem a posse",
    ],
    requisitos: [
      "Declaração de efetiva necessidade da posse",
      "Comprovação de ocupação lícita e residência fixa",
      "Capacidade técnica para o manuseio de arma de fogo (instrutor credenciado)",
      "Aptidão psicológica vigente (psicólogo credenciado PF)",
      "Certidões negativas criminais (Justiça Estadual, Federal, Militar e Eleitoral)",
    ],
    documentos: [
      "Documento de identidade (RG/CIN/CNH) frente e verso",
      "CPF",
      "Comprovante de residência atualizado",
      "Comprovante de ocupação lícita",
      "Laudo de aptidão psicológica (modelo PF)",
      "Atestado de capacidade técnica (modelo PF)",
      "Certidões negativas criminais",
    ],
    etapas: [
      "Cadastro do interessado e checklist documental na Quero Armas",
      "Conferência técnica dos laudos e certidões",
      "Abertura do processo no SINARM/Polícia Federal",
      "Acompanhamento da exigência/análise pela PF",
      "Emissão do Certificado de Registro de Arma de Fogo (CRAF) após decisão favorável",
    ],
    pontosAtencao: [
      "A posse autoriza manter a arma apenas em residência ou local de trabalho, não autoriza o porte.",
      "Validade do laudo psicológico e do atestado de capacidade técnica é limitada — protocolar dentro do prazo.",
      "Limites de calibre e quantidade seguem o Decreto vigente na data do protocolo.",
    ],
    limitesQA:
      "A Quero Armas organiza documentação, faz checklist técnico e protocola o pedido. " +
      DEFERIMENTO_NOTE,
  },

  "aquisicao-registro-posse-de-arma-de-fogo": {
    titulo: "Aquisição / Registro / Posse de Arma de Fogo",
    sistema: "SINARM_PF",
    orgaoCompetente: "Polícia Federal — SINARM",
    baseLegal: [
      "Lei nº 10.826/2003, arts. 4º, 5º e 12",
      ...QA_BASE_LEGAL_SINARM_DEFESA_PESSOAL,
    ],
    oQueE:
      "Pacote completo que integra a autorização de posse, a autorização de aquisição da arma e o subsequente registro no SINARM, com emissão do CRAF.",
    quandoSeAplica:
      "Quando o cidadão ainda não possui posse vigente e quer, em um único fluxo, obter posse, comprar a arma e registrá-la no SINARM.",
    quemPodeSolicitar: [
      "Pessoa física com idade mínima de 25 anos",
      "Sem antecedentes criminais que vedem a posse",
      "Residente no território nacional",
    ],
    requisitos: [
      "Mesmos requisitos da posse (efetiva necessidade, ocupação, capacidade técnica e psicológica, certidões)",
      "Definição prévia do modelo/calibre dentro dos limites do uso permitido",
    ],
    documentos: [
      "Documento de identidade e CPF",
      "Comprovante de residência",
      "Comprovante de ocupação lícita",
      "Laudo psicológico e atestado de capacidade técnica vigentes",
      "Certidões negativas",
      "Dados completos da arma pretendida (modelo, calibre, fabricante)",
      "Nota fiscal de aquisição (na fase de registro)",
    ],
    etapas: [
      "Cadastro e checklist documental",
      "Protocolo da posse no SINARM/PF",
      "Após deferimento, emissão da Autorização de Aquisição (AA)",
      "Compra da arma na loja credenciada",
      "Protocolo do registro e emissão do CRAF",
    ],
    pontosAtencao: [
      "A Autorização de Aquisição possui validade definida pela PF e precisa ser usada dentro do prazo.",
      "Calibres restritos ao uso permitido para civis nesta modalidade.",
      "O CRAF é vinculado ao titular e à arma específica.",
    ],
    limitesQA:
      "A Quero Armas conduz o trâmite documental e o protocolo nas três fases (posse, aquisição e registro). " +
      DEFERIMENTO_NOTE,
  },

  "porte-arma-fogo": {
    titulo: "Porte de Arma de Fogo",
    sistema: "SINARM_PF",
    orgaoCompetente: "Polícia Federal — SINARM",
    baseLegal: [
      "Lei nº 10.826/2003, art. 10 (porte e efetiva necessidade)",
      ...QA_BASE_LEGAL_SINARM_DEFESA_PESSOAL,
    ],
    oQueE:
      "Autorização excepcional e discricionária da Polícia Federal para portar arma de fogo de uso permitido fora da residência ou do local de trabalho.",
    quandoSeAplica:
      "Quando o interessado demonstra, de forma documental e concreta, efetiva necessidade decorrente de risco à integridade física, exposição patrimonial relevante ou outra hipótese expressamente prevista.",
    quemPodeSolicitar: [
      "Pessoa física com idade mínima de 25 anos",
      "Sem antecedentes criminais que vedem o porte",
      "Capaz de demonstrar efetiva necessidade com prova documental concreta",
    ],
    requisitos: [
      "Fundamentação documental da efetiva necessidade",
      "Capacidade técnica e aptidão psicológica vigentes",
      "Ocupação lícita e residência comprovada",
      "Certidões negativas criminais",
    ],
    documentos: [
      "Documento de identidade e CPF",
      "Comprovante de residência e de ocupação",
      "Provas documentais do risco/necessidade (boletins de ocorrência, contratos, registros)",
      "Laudo psicológico e atestado de capacidade técnica vigentes",
      "Certidões negativas",
    ],
    etapas: [
      "Entrevista técnica e mapeamento da efetiva necessidade",
      "Construção da fundamentação documental",
      "Protocolo do pedido de porte na Polícia Federal",
      "Cumprimento de exigências e acompanhamento",
      "Decisão final da PF (deferimento, indeferimento ou diligência)",
    ],
    pontosAtencao: [
      "O porte é decisão discricionária da PF — não basta atender requisitos formais, é preciso convencer da efetiva necessidade.",
      "Categorias de porte funcional (ex.: profissões previstas em lei) seguem regramento próprio e não são equiparadas a porte civil comum.",
      "Indeferimento pode ser combatido por recurso administrativo e, em hipóteses específicas, via judicial.",
    ],
    limitesQA:
      "A Quero Armas estrutura tecnicamente o pedido, organiza prova documental e protocola o porte. " +
      DEFERIMENTO_NOTE,
  },

  "renovacao-de-porte-de-arma-de-fogo": {
    titulo: "Renovação de Porte de Arma de Fogo",
    sistema: "SINARM_PF",
    orgaoCompetente: "Polícia Federal — SINARM",
    baseLegal: [
      "Lei nº 10.826/2003, art. 10",
      ...QA_BASE_LEGAL_SINARM_DEFESA_PESSOAL,
    ],
    oQueE:
      "Procedimento para manter a validade da autorização de porte de arma de fogo já concedida, com reapresentação de requisitos e nova análise pela PF.",
    quandoSeAplica:
      "Próximo ao vencimento do porte vigente, ou dentro do prazo administrativo definido pela PF para renovação.",
    quemPodeSolicitar: [
      "Titular de porte vigente ou dentro da janela de renovação",
      "Sem fato superveniente que comprometa os requisitos originais",
    ],
    requisitos: [
      "Manutenção da efetiva necessidade que justificou a concessão original",
      "Aptidão psicológica e capacidade técnica novamente vigentes",
      "Certidões negativas atualizadas",
    ],
    documentos: [
      "Porte atual",
      "Documento de identidade, CPF e comprovante de residência",
      "Atualização da prova de efetiva necessidade",
      "Novo laudo psicológico e novo atestado de capacidade técnica",
      "Certidões negativas atualizadas",
    ],
    etapas: [
      "Diagnóstico do porte vigente e prazos",
      "Atualização documental e dos laudos",
      "Protocolo da renovação na PF",
      "Acompanhamento da análise e exigências",
    ],
    pontosAtencao: [
      "Renovação não é automática: a PF reavalia a efetiva necessidade.",
      "Perder a janela de renovação pode obrigar a iniciar um novo pedido como se fosse o primeiro.",
    ],
    limitesQA:
      "A Quero Armas organiza a renovação dentro do prazo e protocola junto à PF. " +
      DEFERIMENTO_NOTE,
  },

  "renovacao-posse-de-arma-de-fogo": {
    titulo: "Renovação de Posse de Arma de Fogo",
    sistema: "SINARM_PF",
    orgaoCompetente: "Polícia Federal — SINARM",
    baseLegal: [
      "Lei nº 10.826/2003, arts. 5º e 12",
      ...QA_BASE_LEGAL_SINARM_DEFESA_PESSOAL,
    ],
    oQueE:
      "Renovação do Certificado de Registro de Arma de Fogo (CRAF) emitido pelo SINARM, mantendo a regularidade da posse já concedida.",
    quandoSeAplica:
      "Quando o CRAF da arma está próximo do vencimento ou já dentro da janela de renovação prevista em norma.",
    quemPodeSolicitar: [
      "Titular do CRAF",
      "Sem fatos supervenientes que vedem a posse",
    ],
    requisitos: [
      "Manutenção dos requisitos originais (ocupação, residência, sem antecedentes)",
      "Aptidão psicológica e capacidade técnica novamente vigentes",
      "Certidões negativas atualizadas",
    ],
    documentos: [
      "CRAF atual",
      "Documento de identidade, CPF e comprovante de residência",
      "Novo laudo psicológico e atestado de capacidade técnica",
      "Certidões negativas",
    ],
    etapas: [
      "Conferência do CRAF e prazos",
      "Atualização documental",
      "Protocolo da renovação no SINARM/PF",
      "Acompanhamento até emissão do novo CRAF",
    ],
    pontosAtencao: [
      "O atraso na renovação pode caracterizar irregularidade da posse — manter a arma com CRAF vencido tem consequências.",
      "A renovação trata da posse já concedida, não do porte.",
    ],
    limitesQA:
      "A Quero Armas organiza e protocola a renovação do CRAF. " + DEFERIMENTO_NOTE,
  },

  "registro-arma-fogo": {
    titulo: "Registro de Arma de Fogo (Defesa Pessoal)",
    sistema: "SINARM_PF",
    orgaoCompetente: "Polícia Federal — SINARM",
    baseLegal: [
      "Lei nº 10.826/2003, art. 5º",
      ...QA_BASE_LEGAL_SINARM_DEFESA_PESSOAL,
    ],
    oQueE:
      "Registro no SINARM da arma de fogo de uso permitido adquirida para defesa pessoal, com emissão do CRAF em nome do titular.",
    quandoSeAplica:
      "Após a autorização de aquisição e a compra efetiva da arma em loja credenciada, para vincular o bem ao titular no SINARM.",
    quemPodeSolicitar: [
      "Titular de posse vigente ou de autorização de aquisição em curso",
    ],
    requisitos: [
      "Posse vigente ou Autorização de Aquisição válida",
      "Nota fiscal regular da arma",
      "Dados completos do bem (marca, modelo, calibre, número de série)",
    ],
    documentos: [
      "Documento de identidade, CPF e comprovante de residência",
      "Posse/Autorização de Aquisição",
      "Nota fiscal da arma",
    ],
    etapas: [
      "Conferência da nota fiscal e do bem",
      "Cadastro do registro junto à PF",
      "Acompanhamento de exigências",
      "Emissão do CRAF",
    ],
    pontosAtencao: [
      "Registro de defesa pessoal não habilita transporte habitual nem porte.",
      "O CRAF de defesa pessoal não se confunde com o CRAF de acervo CAC.",
    ],
    limitesQA:
      "A Quero Armas executa o registro técnico e o protocolo. " + DEFERIMENTO_NOTE,
  },

  "recurso-administrativo": {
    titulo: "Recurso Administrativo",
    sistema: "SINARM_PF",
    orgaoCompetente:
      "Autoridade administrativa que proferiu a decisão na Polícia Federal/SINARM-CAC",
    baseLegal: [
      "Lei nº 9.784/1999 (processo administrativo federal)",
      ...QA_BASE_LEGAL_NUCLEO,
      "Instrução Normativa nº 201/2021-DG/PF",
      "Instrução Normativa DG/PF nº 311/2025",
      "Ofício Circular nº 08/DELEARM",
    ],
    oQueE:
      "Peça administrativa de impugnação contra decisão de indeferimento, exigência ou ato administrativo proferido em processo de posse, porte, registro, CR, CRAF, GTE ou correlato.",
    quandoSeAplica:
      "Após ciência da decisão impugnável, dentro do prazo administrativo previsto em lei ou regulamento.",
    quemPodeSolicitar: [
      "Parte interessada do processo administrativo",
      "Representante legal devidamente constituído",
    ],
    requisitos: [
      "Existência de decisão administrativa impugnável",
      "Tempestividade do recurso",
      "Fundamentação técnica e jurídica adequada ao caso",
    ],
    documentos: [
      "Cópia integral da decisão recorrida",
      "Documentos do processo originário",
      "Provas documentais que sustentem o recurso",
      "Documentos pessoais do recorrente",
    ],
    etapas: [
      "Análise técnica da decisão e do processo",
      "Construção da peça recursal fundamentada",
      "Protocolo do recurso junto à autoridade competente",
      "Acompanhamento até decisão recursal",
    ],
    pontosAtencao: [
      "Recurso administrativo não garante reforma da decisão.",
      "Esfera administrativa é distinta da esfera judicial; a depender do caso, pode caber também ação judicial via advogado.",
    ],
    limitesQA:
      "A Quero Armas atua na elaboração técnica e no protocolo do recurso administrativo. " +
      ADV_NOTE +
      " " +
      DEFERIMENTO_NOTE,
  },

  "mandado-de-seguranca": {
    titulo: "Mandado de Segurança",
    sistema: "JUDICIAL",
    orgaoCompetente: "Poder Judiciário competente",
    baseLegal: [
      "Constituição Federal, art. 5º, LXIX e LXX",
      "Lei nº 12.016/2009 (disciplina o mandado de segurança)",
      "Lei nº 8.906/1994 (Estatuto da Advocacia)",
    ],
    oQueE:
      "Ação constitucional judicial cabível para proteger direito líquido e certo lesado ou ameaçado por ato ilegal ou abusivo de autoridade pública.",
    quandoSeAplica:
      "Quando há ato concreto de autoridade (ex.: indeferimento, exigência abusiva, omissão) que viola direito líquido e certo do interessado e existe prova pré-constituída.",
    quemPodeSolicitar: [
      "Pessoa física ou jurídica titular do direito alegado",
      "Sempre por meio de advogado(a) habilitado(a)",
    ],
    requisitos: [
      "Direito líquido e certo demonstrável por prova documental pré-constituída",
      "Ato coator identificado, com autoridade definida",
      "Tempestividade (prazo decadencial de 120 dias)",
    ],
    documentos: [
      "Cópia integral do processo administrativo",
      "Decisão/ato coator e sua publicação/ciência",
      "Documentos pessoais do impetrante",
      "Demais provas pré-constituídas",
    ],
    etapas: [
      "Análise técnica preliminar pela equipe Quero Armas",
      "Encaminhamento a advogado(a) parceiro(a)",
      "Contrato de honorários e procuração — apartados",
      "Distribuição da ação e acompanhamento pelo(a) advogado(a)",
    ],
    pontosAtencao: [
      "Mandado de segurança não é serviço jurídico prestado diretamente pela Quero Armas.",
      "Não há promessa de êxito; concessão de liminar e procedência são decisões exclusivas do Judiciário.",
    ],
    limitesQA:
      "A Quero Armas faz apenas a triagem técnica e o encaminhamento a advogado(a) habilitado(a). " +
      ADV_NOTE,
  },

  // ───────────────────────── CAC / POLÍCIA FEDERAL ─────────────────────────

  "concessao-cr": {
    titulo: "Concessão de CR (Certificado de Registro)",
    sistema: "CAC_PF",
    orgaoCompetente: "Polícia Federal — SINARM-CAC",
    baseLegal: [
      "Lei nº 10.826/2003, art. 6º, § 1º (CAC)",
      ...QA_BASE_LEGAL_SINARM_CAC,
    ],
    oQueE:
      "Concessão do Certificado de Registro (CR) no âmbito da Polícia Federal/SINARM-CAC, habilitando a pessoa física como Atirador Desportivo, Caçador ou Colecionador (CAC).",
    quandoSeAplica:
      "Quando o interessado deseja ingressar oficialmente em uma das categorias CAC para constituir acervo e praticar a atividade nos termos das normas da Polícia Federal.",
    quemPodeSolicitar: [
      "Pessoa física com idade mínima exigida pela categoria pretendida",
      "Filiado a entidade de tiro reconhecida (Atirador) quando aplicável",
      "Sem antecedentes criminais que vedem a categoria",
    ],
    requisitos: [
      "Vinculação a clube/entidade reconhecida quando aplicável",
      "Capacidade técnica para manuseio de arma de fogo",
      "Aptidão psicológica vigente",
      "Certidões negativas criminais",
    ],
    documentos: [
      "Documento de identidade e CPF",
      "Comprovante de residência",
      "Comprovante de filiação a entidade de tiro (quando aplicável)",
      "Laudo psicológico e atestado de capacidade técnica vigentes",
      "Certidões negativas (Estadual, Federal, Militar e Eleitoral)",
    ],
    etapas: [
      "Cadastro e checklist documental",
      "Conferência técnica dos requisitos da categoria",
      "Protocolo do CR no sistema competente da Polícia Federal",
      "Acompanhamento até deferimento e emissão do CR",
    ],
    pontosAtencao: [
      "CR não autoriza porte. Para deslocamento do acervo é necessária Guia de Tráfego (GTE) específica.",
      "Habitualidade é exigida para manutenção da categoria Atirador e da renovação do CR.",
    ],
    limitesQA:
      "A Quero Armas estrutura o pedido e protocola junto à Polícia Federal/SINARM-CAC. " +
      DEFERIMENTO_NOTE,
  },

  "renovacao-cr": {
    titulo: "Renovação de CR",
    sistema: "CAC_PF",
    orgaoCompetente: "Polícia Federal — SINARM-CAC",
    baseLegal: [
      "Lei nº 10.826/2003, art. 6º",
      ...QA_BASE_LEGAL_SINARM_CAC,
    ],
    oQueE:
      "Procedimento para manter a validade do CR já concedido, com atualização documental e demonstração da habitualidade quando exigida.",
    quandoSeAplica:
      "Próximo ao vencimento do CR ou dentro da janela de renovação prevista em norma.",
    quemPodeSolicitar: [
      "Titular do CR vigente ou dentro do prazo de renovação",
    ],
    requisitos: [
      "CR vigente ou dentro do prazo de renovação",
      "Habitualidade comprovada (Atirador) conforme norma",
      "Aptidão psicológica e capacidade técnica novamente vigentes",
      "Certidões negativas atualizadas",
    ],
    documentos: [
      "CR atual",
      "Documento de identidade, CPF e comprovante de residência",
      "Comprovante de habitualidade emitido pelo clube (quando aplicável)",
      "Novos laudos psicológico e técnico",
      "Certidões negativas",
    ],
    etapas: [
      "Conferência do CR e da habitualidade",
      "Atualização documental",
      "Protocolo da renovação no sistema competente da Polícia Federal",
      "Acompanhamento até emissão do novo CR",
    ],
    pontosAtencao: [
      "Habitualidade insuficiente é causa frequente de exigência ou indeferimento.",
      "Perder a janela pode obrigar a iniciar nova concessão.",
    ],
    limitesQA:
      "A Quero Armas conduz a renovação e o protocolo na Polícia Federal/SINARM-CAC. " +
      DEFERIMENTO_NOTE,
  },

  "apostilamento-atualizacao": {
    titulo: "Apostilamento — Atualização de Acervo",
    sistema: "CAC_PF",
    orgaoCompetente: "Polícia Federal — SINARM-CAC",
    baseLegal: [
      ...QA_BASE_LEGAL_SINARM_CAC,
    ],
    oQueE:
      "Procedimento de inclusão, alteração ou atualização de itens do acervo CAC no CR, com registro formal na Polícia Federal/SINARM-CAC.",
    quandoSeAplica:
      "Sempre que houver entrada, baixa, transferência ou alteração de dados de item do acervo, e quando houver mudança de qualificação cadastral relevante.",
    quemPodeSolicitar: ["Titular do CR vigente"],
    requisitos: [
      "CR vigente",
      "Documentação completa do item objeto do apostilamento",
    ],
    documentos: [
      "CR atual",
      "Documento de identidade e CPF",
      "Documentos do item (nota fiscal, CRAF, autorização)",
    ],
    etapas: [
      "Conferência do acervo e do item",
      "Montagem do pedido de apostilamento",
      "Protocolo no sistema competente da Polícia Federal",
      "Atualização do CR/CRAF",
    ],
    pontosAtencao: [
      "Acervo desatualizado gera inconsistência e pode prejudicar GTE, renovação e novas aquisições.",
    ],
    limitesQA:
      "A Quero Armas executa o apostilamento administrativamente. " +
      DEFERIMENTO_NOTE,
  },

  "registro-e-apostilamento-de-arma-de-fogo-cac": {
    titulo: "Registro e Apostilamento de Arma de Fogo (CAC)",
    sistema: "CAC_PF",
    orgaoCompetente: "Polícia Federal — SINARM-CAC",
    baseLegal: [
      "Lei nº 10.826/2003, art. 6º",
      ...QA_BASE_LEGAL_SINARM_CAC,
    ],
    oQueE:
      "Emissão do CRAF da arma adquirida pelo CAC e respectivo apostilamento do item no CR.",
    quandoSeAplica:
      "Após a aquisição da arma com Autorização de Compra emitida pela autoridade competente, para registrá-la formalmente no acervo CAC.",
    quemPodeSolicitar: ["Titular de CR vigente com Autorização de Compra utilizada"],
    requisitos: [
      "CR vigente",
      "Autorização de Compra dentro do prazo",
      "Nota fiscal da arma adquirida",
    ],
    documentos: [
      "CR atual",
      "Autorização de Compra utilizada",
      "Nota fiscal e dados completos da arma",
      "Documento de identidade e CPF",
    ],
    etapas: [
      "Conferência da nota fiscal e do bem",
      "Cadastro do registro no sistema competente",
      "Apostilamento do item no CR",
      "Emissão do CRAF",
    ],
    pontosAtencao: [
      "CRAF de acervo CAC possui regramento próprio e deve permanecer compatível com o CR vigente.",
      "Limites de acervo por categoria devem ser respeitados.",
    ],
    limitesQA:
      "A Quero Armas executa o registro e o apostilamento junto à Polícia Federal/SINARM-CAC. " +
      DEFERIMENTO_NOTE,
  },

  "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac": {
    titulo: "Autorização de Compra de Arma de Fogo — Atirador Esportivo (CAC)",
    sistema: "CAC_PF",
    orgaoCompetente: "Polícia Federal — SINARM-CAC",
    baseLegal: [
      "Lei nº 10.826/2003, art. 6º, § 1º",
      ...QA_BASE_LEGAL_SINARM_CAC,
    ],
    oQueE:
      "Serviço de autorização de compra de arma de fogo para atiradores desportivos, dentro dos limites de calibre, quantidade e habitualidade da categoria.",
    quandoSeAplica:
      "Quando o Atirador CAC pretende adquirir nova arma para uso na atividade desportiva, respeitando o limite do acervo.",
    quemPodeSolicitar: [
      "Titular de CR vigente na categoria Atirador",
      "Com habitualidade compatível com a aquisição",
    ],
    requisitos: [
      "CR Atirador vigente",
      "Habitualidade comprovada",
      "Acervo dentro do limite normativo da categoria",
    ],
    documentos: [
      "CR atual",
      "Comprovante de habitualidade",
      "Dados completos da arma pretendida (modelo, calibre, fabricante)",
      "Documento de identidade e CPF",
    ],
    etapas: [
      "Conferência do CR, habitualidade e acervo",
      "Montagem do pedido com fundamento da finalidade desportiva",
      "Protocolo no sistema competente da Polícia Federal",
      "Emissão da Autorização de Compra",
    ],
    pontosAtencao: [
      "Validade da Autorização de Compra é limitada — usar dentro do prazo.",
      "Calibre e quantidade devem respeitar as regras vigentes para Atirador.",
    ],
    limitesQA:
      "A Quero Armas estrutura e protocola o pedido de compra junto à Polícia Federal/SINARM-CAC. " +
      DEFERIMENTO_NOTE,
  },

  "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac": {
    titulo: "Autorização de Compra de Arma de Fogo — Caçador (CAC)",
    sistema: "CAC_PF",
    orgaoCompetente: "Polícia Federal — SINARM-CAC",
    baseLegal: [
      "Lei nº 10.826/2003, art. 6º, § 1º",
      ...QA_BASE_LEGAL_SINARM_CAC,
    ],
    oQueE:
      "Serviço de autorização de compra de arma de fogo para Caçadores CAC, respeitando finalidade, calibre e limites do acervo.",
    quandoSeAplica:
      "Quando o Caçador CAC pretende adquirir nova arma compatível com a atividade de caça nos termos da norma.",
    quemPodeSolicitar: [
      "Titular de CR vigente na categoria Caçador",
    ],
    requisitos: [
      "CR Caçador vigente",
      "Acervo dentro do limite normativo da categoria",
      "Compatibilidade do calibre pretendido com a finalidade de caça",
    ],
    documentos: [
      "CR atual",
      "Dados completos da arma pretendida",
      "Documento de identidade e CPF",
    ],
    etapas: [
      "Conferência do CR e do acervo",
      "Justificativa da finalidade de caça",
      "Protocolo no sistema competente da Polícia Federal",
      "Emissão da Autorização de Compra",
    ],
    pontosAtencao: [
      "A categoria Caçador tem regramento próprio, distinto de Atirador.",
      "Validade da autorização e calibres permitidos seguem a norma vigente.",
    ],
    limitesQA:
      "A Quero Armas estrutura e protocola o pedido específico de Caçador. " +
      DEFERIMENTO_NOTE,
  },

  "guia-de-trafego-especial-cac": {
    titulo: "Guia de Tráfego Especial (GTE) — CAC",
    sistema: "CAC_PF",
    orgaoCompetente: "Polícia Federal — SINARM-CAC",
    baseLegal: [
      ...QA_BASE_LEGAL_SINARM_CAC,
    ],
    oQueE:
      "Autorização competente para transporte de arma e munição do acervo CAC, entre origem e destino determinados, dentro de prazo específico.",
    quandoSeAplica:
      "Para deslocamento autorizado do acervo: treinos, competições, manutenção, caça, mudança de endereço ou eventos previstos em norma.",
    quemPodeSolicitar: ["Titular de CR vigente com acervo registrado no sistema competente"],
    requisitos: [
      "CR vigente",
      "Item(ns) do acervo regularmente registrado(s) (CRAF)",
      "Justificativa de deslocamento compatível com a norma",
    ],
    documentos: [
      "CR vigente",
      "CRAF das armas a transportar",
      "Dados de origem, destino e período do deslocamento",
      "Comprovante do evento/finalidade quando aplicável",
    ],
    etapas: [
      "Conferência do acervo a transportar",
      "Montagem da GTE com origem, destino, calibres e quantidades",
      "Protocolo no sistema competente da Polícia Federal",
      "Entrega da GTE ao titular",
    ],
    pontosAtencao: [
      "Transportar o acervo sem GTE válida configura irregularidade.",
      "Munição e quantidade transportadas devem respeitar a GTE emitida.",
    ],
    limitesQA:
      "A Quero Armas emite tecnicamente a GTE e a protocola junto à Polícia Federal/SINARM-CAC. " +
      DEFERIMENTO_NOTE,
  },

  "mudanca-servico": {
    titulo: "Mudança de Serviço (Posse → CR)",
    sistema: "CAC_PF",
    orgaoCompetente:
      "Polícia Federal — SINARM-CAC",
    baseLegal: [
      ...QA_BASE_LEGAL_SINARM_CAC,
    ],
    oQueE:
      "Procedimento de regularização ou alteração cadastral de arma originalmente registrada no SINARM para acervo CAC, ou mudança da modalidade de serviço do titular.",
    quandoSeAplica:
      "Quando o titular de arma SINARM deseja vinculá-la formalmente ao acervo CAC após obtenção do CR.",
    quemPodeSolicitar: [
      "Titular do CRAF SINARM da arma",
      "Com CR CAC vigente compatível",
    ],
    requisitos: [
      "CR CAC vigente",
      "CRAF SINARM da arma a transferir",
      "Compatibilidade do calibre/categoria com o acervo CAC pretendido",
    ],
    documentos: [
      "CR CAC e CRAF SINARM",
      "Documento de identidade e CPF",
      "Comprovante de residência",
    ],
    etapas: [
      "Diagnóstico da arma e da categoria CAC de destino",
      "Protocolo de baixa/transferência junto à PF (SINARM)",
      "Protocolo de inclusão no acervo CAC com apostilamento",
      "Emissão do CRAF correspondente",
    ],
    pontosAtencao: [
      "Procedimento exige sincronização documental entre cadastro, CR, CRAF e acervo.",
      "Calibres restritos podem inviabilizar a transferência.",
    ],
    limitesQA:
      "A Quero Armas conduz tecnicamente a regularização junto à Polícia Federal/SINARM-CAC. " +
      DEFERIMENTO_NOTE,
  },

  // ───────────────────────── CURSOS / ESTANDE ─────────────────────────

  "operador-de-pistola-nivel-i": {
    titulo: "Operador de Pistola — Nível I",
    sistema: "CURSO_ESTANDE",
    orgaoCompetente:
      "Estande/instrutor credenciado (curso operacional, não é autorização estatal)",
    baseLegal: [
      "Conteúdo operacional alinhado a boas práticas de tiro defensivo e à legislação de armas vigente",
      ...QA_BASE_LEGAL_CURSO_E_MANUSEIO,
    ],
    oQueE:
      "Curso operacional de manuseio e operação de pistola — fundamentos de segurança, saque, empunhadura, mira, gatilho, recargas e resolução de panes.",
    quandoSeAplica:
      "Quando o aluno deseja qualificação prática operacional com pistola, em ambiente controlado de estande.",
    quemPodeSolicitar: [
      "Maiores de idade dentro dos critérios do estande",
      "Sem impedimento para frequentar estande de tiro",
    ],
    requisitos: [
      "Aptidão para a atividade de tiro no estande",
      "Equipamentos básicos de proteção (fornecidos ou exigidos conforme curso)",
    ],
    documentos: ["Documento de identidade e CPF"],
    etapas: [
      "Inscrição e confirmação de turma",
      "Parte teórica (segurança, legislação aplicada, fundamentos)",
      "Parte prática no estande",
      "Emissão do certificado/atestado operacional",
    ],
    pontosAtencao: [
      "Curso operacional não é, por si, autorização para posse, porte ou aquisição de arma — não substitui o atestado de capacidade técnica oficial quando ele for exigido.",
      "Conteúdo prático segue normas internas do estande e dos instrutores.",
    ],
    limitesQA:
      "A Quero Armas intermedia a contratação, organização da turma e logística. A execução técnica é do estande/instrutor credenciado.",
  },

  "vip-operador-de-pistola-nivel-i": {
    titulo: "VIP — Operador de Pistola Nível I",
    sistema: "CURSO_ESTANDE",
    orgaoCompetente:
      "Estande/instrutor credenciado em formato VIP (curso operacional, não é autorização estatal)",
    baseLegal: [
      "Conteúdo operacional alinhado a boas práticas de tiro defensivo e à legislação de armas vigente",
      ...QA_BASE_LEGAL_CURSO_E_MANUSEIO,
    ],
    oQueE:
      "Versão VIP do Nível I, em formato reservado e personalizado, com atenção individual do instrutor, agenda flexível e maior aproveitamento por aluno.",
    quandoSeAplica:
      "Quando o aluno prefere atendimento personalizado, com discrição e ritmo próprio, em vez de turma aberta.",
    quemPodeSolicitar: [
      "Maiores de idade dentro dos critérios do estande",
    ],
    requisitos: [
      "Aptidão para a atividade de tiro",
      "Disponibilidade para agenda reservada",
    ],
    documentos: ["Documento de identidade e CPF"],
    etapas: [
      "Pré-atendimento e definição de objetivos",
      "Agendamento reservado no estande",
      "Execução teórica e prática personalizada",
      "Emissão do certificado/atestado operacional",
    ],
    pontosAtencao: [
      "Mesmo no formato VIP, o curso é operacional e não é autorização estatal.",
      "Eventual emissão de atestado oficial depende dos requisitos previstos em norma.",
    ],
    limitesQA:
      "A Quero Armas estrutura e contrata o formato VIP. A execução técnica é do instrutor credenciado.",
  },
};

export function getServiceLegalDetails(slug: string): ServiceLegalDetails | null {
  return DETAILS[slug] ?? null;
}

export const sistemaLabel: Record<SistemaAplicavel, string> = {
  SINARM_PF: "SINARM",
  CAC_PF: "SINARM-CAC",
  JUDICIAL: "Esfera Judicial",
  CURSO_ESTANDE: "Curso operacional / estande",
  INTERNO: "Atendimento interno",
};

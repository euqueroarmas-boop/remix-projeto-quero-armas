import { isDocDeArma } from "./documentosDeArma";

export type HubCategoria =
  | "identificacao"
  | "endereco"
  | "renda_ocupacao"
  | "antecedentes_regularidade"
  | "declaracoes"
  | "laudos_exames"
  | "efetiva_necessidade"
  | "arma_acervo"
  | "cac_atividade"
  | "documentos_processo"
  | "juridico"
  | "outros";

export type EscopoDocumental = "permanente" | "arma" | "processo" | "cac_atividade";

export interface HubCategoriaMeta {
  value: HubCategoria;
  label: string;
  description: string;
  escopoPadrao: EscopoDocumental;
}

export interface HubTipoDocumentoMeta {
  value: string;
  label: string;
  short: string;
  categoria: HubCategoria;
  escopo: EscopoDocumental;
  aceitaIA?: boolean;
  aceitaVinculoArma?: boolean;
  exigeValidade?: boolean;
  revisaoHumanaObrigatoria?: boolean;
}

export const HUB_CATEGORIAS: readonly HubCategoriaMeta[] = [
  {
    value: "identificacao",
    label: "Identificação civil",
    description: "RG com CPF, CNH, CIN, CPF e documentos civis do titular.",
    escopoPadrao: "permanente",
  },
  {
    value: "endereco",
    label: "Residência",
    description: "Comprovantes residenciais e declarações relacionadas ao imóvel.",
    escopoPadrao: "permanente",
  },
  {
    value: "renda_ocupacao",
    label: "Renda / ocupação",
    description: "Comprovantes de atividade profissional, renda e benefício.",
    escopoPadrao: "permanente",
  },
  {
    value: "antecedentes_regularidade",
    label: "Certidões e regularidade",
    description: "Antecedentes e certidões utilizadas na triagem administrativa.",
    escopoPadrao: "permanente",
  },
  {
    value: "declaracoes",
    label: "Declarações pessoais",
    description: "Declarações do titular, de guarda responsável e declarações correlatas.",
    escopoPadrao: "permanente",
  },
  {
    value: "laudos_exames",
    label: "Laudos e exames",
    description: "Laudos psicológicos, capacidade técnica e exames correlatos.",
    escopoPadrao: "permanente",
  },
  {
    value: "efetiva_necessidade",
    label: "Justificativas / necessidade",
    description: "Efetiva necessidade e documentos complementares do caso concreto.",
    escopoPadrao: "processo",
  },
  {
    value: "arma_acervo",
    label: "Armas e acervo",
    description: "CR, CRAF, GTE, GT, autorizações de compra e documentos da arma.",
    escopoPadrao: "arma",
  },
  {
    value: "cac_atividade",
    label: "CAC / habitualidade",
    description: "Documentos de habitualidade, clube, competição e atividade do CAC.",
    escopoPadrao: "cac_atividade",
  },
  {
    value: "documentos_processo",
    label: "Documentos processuais",
    description: "Protocolos, ofícios, despachos, exigências, indeferimentos, recursos e peças do caso.",
    escopoPadrao: "processo",
  },
  {
    value: "juridico",
    label: "Documentos jurídicos",
    description: "Procurações, recursos, mandados e demais peças jurídicas do caso.",
    escopoPadrao: "processo",
  },
  {
    value: "outros",
    label: "Outros",
    description: "Anexos complementares que ainda não se encaixam no catálogo.",
    escopoPadrao: "processo",
  },
] as const;

export const HUB_TIPOS_DOCUMENTO: readonly HubTipoDocumentoMeta[] = [
  { value: "rg_com_cpf", label: "RG com CPF", short: "RG", categoria: "identificacao", escopo: "permanente", aceitaIA: true },
  { value: "cin", label: "CIN — Carteira de Identidade Nacional", short: "CIN", categoria: "identificacao", escopo: "permanente", aceitaIA: true },
  { value: "cnh", label: "CNH — Carteira Nacional de Habilitação", short: "CNH", categoria: "identificacao", escopo: "permanente", aceitaIA: true },
  { value: "cpf", label: "CPF", short: "CPF", categoria: "identificacao", escopo: "permanente", aceitaIA: true },
  { value: "comprovante_residencia", label: "Comprovante de residência", short: "END", categoria: "endereco", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "declaracao_responsavel_imovel", label: "Declaração do responsável pelo imóvel", short: "DECL. IMÓVEL", categoria: "endereco", escopo: "permanente" },
  { value: "ctps", label: "Carteira de Trabalho (CTPS)", short: "CTPS", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_holerite_mes_atual", label: "Holerite mais recente", short: "HOLERITE", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "renda_holerite_funcionario_publico", label: "Holerite recente (servidor público)", short: "HOL. SERVIDOR", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "renda_cartao_cnpj", label: "Cartão CNPJ", short: "CNPJ", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_contrato_social", label: "Contrato Social", short: "CONTRATO", categoria: "renda_ocupacao", escopo: "permanente" },
  { value: "renda_cnpj_autonomo", label: "Cartão CNPJ (autônomo / MEI)", short: "MEI", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true },
  { value: "renda_nf_recente", label: "Nota fiscal recente", short: "NF", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "renda_comprovante_beneficio", label: "Comprovante de benefício", short: "BENEFÍCIO", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "renda_extrato_inss", label: "Extrato INSS", short: "INSS", categoria: "renda_ocupacao", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "antecedentes_criminais", label: "Certidão de Antecedentes Criminais — Polícia Civil/SP (IIRGD)", short: "Certidão de Antecedentes Criminais — Polícia Civil/SP (IIRGD)", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_federal", label: "Certidão de Distribuição Criminal — Justiça Federal", short: "Certidão de Distribuição Criminal — Justiça Federal", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_estadual", label: "Certidão Estadual Criminal — TJSP", short: "Certidão Estadual Criminal — TJSP", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_militar", label: "Certidão Criminal Militar", short: "Certidão Criminal Militar", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "antecedentes_eleitoral", label: "Certidão de Crimes Eleitorais — TSE", short: "Certidão de Crimes Eleitorais — TSE", categoria: "antecedentes_regularidade", escopo: "permanente", exigeValidade: true },
  { value: "declaracao_sem_inquerito_processo_criminal", label: "Declaração de não responder a inquérito/processo", short: "DECL. PENAL", categoria: "declaracoes", escopo: "permanente", revisaoHumanaObrigatoria: true },
  { value: "declaracao_guarda_responsavel", label: "Declaração de guarda responsável", short: "DECL. GUARDA", categoria: "declaracoes", escopo: "permanente", revisaoHumanaObrigatoria: true },
  { value: "declaracao_correlata", label: "Declaração correlata", short: "DECLARAÇÃO", categoria: "declaracoes", escopo: "permanente", revisaoHumanaObrigatoria: true },
  { value: "declaracao_guarda_acervo_1endereco", label: "Declaração de guarda de acervo — 1 endereço", short: "GUARDA 1 END", categoria: "declaracoes", escopo: "cac_atividade", revisaoHumanaObrigatoria: true },
  { value: "declaracao_guarda_acervo_2enderecos", label: "Declaração de guarda de acervo — 2 endereços", short: "GUARDA 2 END", categoria: "declaracoes", escopo: "cac_atividade", revisaoHumanaObrigatoria: true },
  { value: "declaracao_homonimia", label: "Declaração de homonímia", short: "HOMONÍMIA", categoria: "declaracoes", escopo: "permanente", revisaoHumanaObrigatoria: true },
  { value: "laudo_psicologico", label: "Laudo psicológico", short: "LAUDO PSI", categoria: "laudos_exames", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "laudo_capacidade_tecnica", label: "Atestado de capacidade técnica", short: "LAUDO TÉC.", categoria: "laudos_exames", escopo: "permanente", aceitaIA: true, exigeValidade: true },
  { value: "comprovante_efetiva_necessidade", label: "Comprovação de efetiva necessidade", short: "NECESSIDADE", categoria: "efetiva_necessidade", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "documento_complementar_caso", label: "Documento complementar do caso", short: "COMPLEMENTAR", categoria: "efetiva_necessidade", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "cr", label: "CR — Certificado de Registro de Colecionador, Atirador Desportivo e Caçador (Exército)", short: "CR · Cert. Registro CAC", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, exigeValidade: true },
  { value: "craf", label: "CRAF — Certificado de Registro de Arma de Fogo", short: "CRAF · Cert. Reg. de Arma de Fogo", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true, exigeValidade: true },
  { value: "sinarm", label: "SINARM — Certificado de Registro de Arma de Fogo (Polícia Federal)", short: "SINARM · Reg. PF", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true, exigeValidade: true },
  { value: "gt", label: "GT — Guia de Tráfego", short: "GT · Guia de Tráfego", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true, exigeValidade: true },
  { value: "gte", label: "GTE — Guia de Tráfego Eventual", short: "GTE · Guia de Tráfego Eventual", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true, exigeValidade: true },
  { value: "autorizacao_compra", label: "Autorização de compra", short: "AC", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true, exigeValidade: true },
  { value: "nota_fiscal_arma", label: "Nota fiscal da arma", short: "NF ARMA", categoria: "arma_acervo", escopo: "arma", aceitaIA: true, aceitaVinculoArma: true },
  { value: "comprovante_habitualidade", label: "Comprovante de habitualidade", short: "HABITUALIDADE", categoria: "cac_atividade", escopo: "cac_atividade", exigeValidade: true },
  { value: "comprovante_clube_tiro", label: "Comprovante de clube / entidade", short: "CLUBE", categoria: "cac_atividade", escopo: "cac_atividade", exigeValidade: true },
  { value: "comprovante_competicao", label: "Comprovante de competição / atividade", short: "COMPETIÇÃO", categoria: "cac_atividade", escopo: "cac_atividade", exigeValidade: true },
  { value: "protocolo_processo", label: "Protocolo do processo", short: "PROTOCOLO", categoria: "documentos_processo", escopo: "processo" },
  { value: "oficio", label: "Ofício", short: "OFÍCIO", categoria: "documentos_processo", escopo: "processo" },
  { value: "despacho", label: "Despacho / movimentação", short: "DESPACHO", categoria: "documentos_processo", escopo: "processo" },
  { value: "exigencia", label: "Exigência administrativa", short: "EXIGÊNCIA", categoria: "documentos_processo", escopo: "processo" },
  { value: "indeferimento", label: "Indeferimento", short: "INDEFER.", categoria: "documentos_processo", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "procuracao", label: "Procuração", short: "PROC.", categoria: "juridico", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "recurso_administrativo_doc", label: "Recurso administrativo", short: "RECURSO", categoria: "juridico", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "mandado_seguranca_doc", label: "Mandado de segurança / peça jurídica", short: "MS", categoria: "juridico", escopo: "processo", revisaoHumanaObrigatoria: true },
  { value: "outro", label: "Outro documento", short: "OUTRO", categoria: "outros", escopo: "processo" },
] as const;

const META_BY_TIPO = new Map(HUB_TIPOS_DOCUMENTO.map((item) => [item.value, item] as const));

const CATEGORIA_BY_TIPO_PREFIX: Array<[RegExp, HubCategoria]> = [
  [/^renda_/, "renda_ocupacao"],
  [/^antecedentes_/, "antecedentes_regularidade"],
  [/^declaracao_/, "declaracoes"],
  [/^laudo_/, "laudos_exames"],
];

export function getHubCategoriaMeta(categoria: HubCategoria): HubCategoriaMeta {
  return (
    HUB_CATEGORIAS.find((item) => item.value === categoria) ?? HUB_CATEGORIAS[HUB_CATEGORIAS.length - 1]
  );
}

export function getTipoDocumentoMeta(tipoDocumento: string | null | undefined): HubTipoDocumentoMeta | null {
  if (!tipoDocumento) return null;
  return META_BY_TIPO.get(String(tipoDocumento).trim().toLowerCase()) ?? null;
}

function normalizeDocumentoName(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—\-/_.|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanDocumentoName(value: unknown): string {
  return String(value || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function inferNomeCertidaoOficial(doc: Record<string, unknown>): string | null {
  const tipo = String(doc?.tipo_documento || "").trim().toLowerCase();
  const haystack = normalizeDocumentoName([
    doc?.nome_documento,
    doc?.arquivo_nome,
    doc?.orgao_emissor,
    doc?.numero_documento,
  ].filter(Boolean).join(" "));

  if (tipo === "antecedentes_eleitoral" || haystack.includes("CRIMES ELEITORAIS")) {
    return "Certidão de Crimes Eleitorais — TSE";
  }

  if (tipo === "antecedentes_estadual") {
    if (haystack.includes("EXECUCOES") || haystack.includes("EXECUCAO") || haystack.includes("1448406")) {
      return "Certidão Estadual de Execuções Criminais — TJSP";
    }
    if (haystack.includes("DISTRIBUICOES") || haystack.includes("DISTRIBUICAO") || haystack.includes("1448405")) {
      return "Certidão Estadual de Distribuições Criminais — TJSP";
    }
    return "Certidão Estadual Criminal — TJSP";
  }

  if (tipo === "antecedentes_federal") {
    if (haystack.includes("JUDICIARIA SP") || haystack.includes("SECAO JUDICIARIA") || haystack.includes("JEF") || haystack.includes("871659")) {
      return "Certidão de Distribuição Criminal — Seção Judiciária de São Paulo e JEF/SP";
    }
    if (haystack.includes("TRIBUNAL REGIONAL FEDERAL") || haystack.includes("TRF DA 3") || haystack.includes("3A REGIAO") || haystack.includes("3 REGIAO")) {
      return "Certidão de Distribuição Criminal — Tribunal Regional Federal da 3ª Região";
    }
    return "Certidão de Distribuição Criminal — Justiça Federal";
  }

  if (tipo === "antecedentes_militar") {
    if (haystack.includes("MILITAR DA UNIAO") || haystack.includes("STM") || haystack.includes("29983659")) {
      return "Certidão Negativa de Crimes Militares — Justiça Militar da União (STM)";
    }
    if (haystack.includes("TJM") || haystack.includes("JUSTICA MILITAR DO ESTADO DE SAO PAULO") || haystack.includes("22E982")) {
      return "Certidão de Antecedentes Criminais — Justiça Militar/SP (TJM-SP)";
    }
    return "Certidão Criminal Militar";
  }

  if (tipo === "antecedentes_criminais") {
    return "Certidão de Antecedentes Criminais — Polícia Civil/SP (IIRGD)";
  }

  // ===== Identificação civil =====
  if (tipo === "rg_com_cpf" || tipo === "rg") {
    return "Cédula de Identidade (RG) com CPF";
  }
  if (tipo === "cin") {
    return "Carteira de Identidade Nacional (CIN)";
  }
  if (tipo === "cnh") {
    return "Carteira Nacional de Habilitação (CNH)";
  }
  if (tipo === "cpf") {
    return "Cadastro de Pessoas Físicas (CPF)";
  }

  // ===== Comprovante de residência =====
  if (tipo === "comprovante_residencia") {
    if (haystack.includes("ENERGIA") || haystack.includes("ELETROPAULO") || haystack.includes("ENEL") || haystack.includes("CPFL") || haystack.includes("LIGHT") || haystack.includes("ELETRICA")) {
      return "Comprovante de Residência — Conta de Energia Elétrica";
    }
    if (haystack.includes("SABESP") || haystack.includes("AGUA") || haystack.includes("SANEAMENTO")) {
      return "Comprovante de Residência — Conta de Água";
    }
    if (haystack.includes("COMGAS") || haystack.includes("GAS NATURAL") || haystack.includes(" GAS ")) {
      return "Comprovante de Residência — Conta de Gás";
    }
    if (haystack.includes("VIVO") || haystack.includes("CLARO") || haystack.includes("TIM") || haystack.includes("OI ") || haystack.includes("TELEFONE") || haystack.includes("INTERNET") || haystack.includes("BANDA LARGA")) {
      return "Comprovante de Residência — Conta de Telefone/Internet";
    }
    if (haystack.includes("IPTU")) {
      return "Comprovante de Residência — IPTU";
    }
    if (haystack.includes("CONDOMINIO")) {
      return "Comprovante de Residência — Boleto de Condomínio";
    }
    return "Comprovante de Residência";
  }

  // ===== Laudos e exames =====
  if (tipo === "laudo_psicologico") {
    return "Laudo de Avaliação Psicológica para Aquisição/Porte de Arma de Fogo";
  }
  if (tipo === "laudo_capacidade_tecnica") {
    return "Atestado de Capacidade Técnica para Manuseio de Arma de Fogo";
  }

  // ===== Documentos de arma / acervo =====
  if (tipo === "cr") {
    return "CR — Certificado de Registro de Colecionador, Atirador Desportivo e Caçador (Exército)";
  }
  if (tipo === "craf") {
    return "CRAF — Certificado de Registro de Arma de Fogo";
  }
  if (tipo === "sinarm") {
    return "SINARM — Certificado de Registro de Arma de Fogo (Polícia Federal)";
  }
  if (tipo === "gt") {
    return "GT — Guia de Tráfego";
  }
  if (tipo === "gte") {
    return "GTE — Guia de Tráfego Eventual";
  }

  return null;
}

function shouldReplaceNomeCertidao(nome: string, tipoDocumento: string | null | undefined): boolean {
  const tipo = String(tipoDocumento || "").trim().toLowerCase();
  const elegivelInferencia =
    tipo.startsWith("antecedentes_") ||
    tipo === "rg_com_cpf" ||
    tipo === "rg" ||
    tipo === "cin" ||
    tipo === "cnh" ||
    tipo === "cpf" ||
    tipo === "comprovante_residencia" ||
    tipo === "laudo_psicologico" ||
    tipo === "laudo_capacidade_tecnica" ||
    tipo === "cr" ||
    tipo === "craf" ||
    tipo === "sinarm" ||
    tipo === "gt" ||
    tipo === "gte";
  if (!elegivelInferencia) return false;
  const normalized = normalizeDocumentoName(nome);
  const meta = getTipoDocumentoMeta(tipo);
  return (
    !normalized ||
    normalized.includes("QUITACAO ELEITORAL") ||
    normalized.startsWith("ANT ") ||
    normalized.startsWith("ANT.") ||
    normalized === "RG" ||
    normalized === "CIN" ||
    normalized === "CNH" ||
    normalized === "CPF" ||
    normalized === "END" ||
    normalized === "LAUDO PSI" ||
    normalized === "LAUDO TEC" ||
    normalized === "LAUDO PSICOLOGICO" ||
    normalized === "COMPROVANTE DE RESIDENCIA" ||
    normalized === "CR" ||
    normalized === "CR CAC" ||
    normalized === "CRAF" ||
    normalized === "SINARM" ||
    normalized === "GT" ||
    normalized === "GTE" ||
    normalized === normalizeDocumentoName(meta?.label) ||
    normalized === normalizeDocumentoName(meta?.short)
  );
}

export function getNomeDocumentoDisplay(doc: Record<string, unknown> | null | undefined, fallback = "Documento"): string {
  if (!doc) return fallback;
  const tipo = String(doc?.tipo_documento || "").trim().toLowerCase();
  const meta = getTipoDocumentoMeta(tipo);
  const explicit = cleanDocumentoName(doc?.nome_documento);
  const inferred = inferNomeCertidaoOficial(doc);

  if (explicit && !shouldReplaceNomeCertidao(explicit, tipo)) return explicit;
  return inferred || explicit || meta?.short || meta?.label || cleanDocumentoName(doc?.arquivo_nome) || fallback;
}

export function inferHubCategoriaFromTipo(tipoDocumento: string | null | undefined): HubCategoria {
  const tipo = String(tipoDocumento || "").trim().toLowerCase();
  if (!tipo) return "outros";
  const meta = getTipoDocumentoMeta(tipo);
  if (meta) return meta.categoria;
  if (isDocDeArma(tipo)) return "arma_acervo";
  if (tipo.includes("efetiva_necessidade")) return "efetiva_necessidade";
  if (tipo.includes("procuracao") || tipo.includes("recurso") || tipo.includes("mandado")) return "juridico";
  if (tipo.includes("protocolo") || tipo.includes("indeferimento") || tipo.includes("exigencia")) return "documentos_processo";
  if (tipo.includes("oficio") || tipo.includes("despacho")) return "documentos_processo";
  if (tipo.includes("habitualidade") || tipo.includes("clube") || tipo.includes("competicao")) return "cac_atividade";
  for (const [pattern, categoria] of CATEGORIA_BY_TIPO_PREFIX) {
    if (pattern.test(tipo)) return categoria;
  }
  return "outros";
}

export function inferEscopoDocumental(input: {
  tipo_documento?: string | null;
  categoria_hub?: HubCategoria | null;
  arma_id?: string | null;
}): EscopoDocumental {
  const categoria = input.categoria_hub ?? inferHubCategoriaFromTipo(input.tipo_documento);
  if (input.arma_id && String(input.arma_id).trim()) return "arma";
  const meta = getTipoDocumentoMeta(String(input.tipo_documento || "").toLowerCase());
  if (meta) return meta.escopo;
  return getHubCategoriaMeta(categoria).escopoPadrao;
}

export function listTiposByCategoria(categoria: HubCategoria): HubTipoDocumentoMeta[] {
  return HUB_TIPOS_DOCUMENTO.filter((item) => item.categoria === categoria);
}

export function isCategoriaArmaAcervo(categoria: HubCategoria | null | undefined): boolean {
  return categoria === "arma_acervo";
}

export function isCategoriaPermanente(categoria: HubCategoria | null | undefined): boolean {
  return (
    categoria === "identificacao" ||
    categoria === "endereco" ||
    categoria === "renda_ocupacao" ||
    categoria === "antecedentes_regularidade" ||
    categoria === "declaracoes" ||
    categoria === "laudos_exames"
  );
}

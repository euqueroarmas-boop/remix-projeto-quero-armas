// ============================================================================
// templatePlaceholders.ts
// ----------------------------------------------------------------------------
// Fonte única dos placeholders aceitos nos templates .docx do Quero Armas.
// Usado por:
//   • DocumentDataOnboardingWizard (wizard KYC do portal)
//   • TemplatePlaceholderInspector (admin)
//   • Edges qa-fill-template / qa-fill-template-cliente (guard + merge)
//
// REGRA:
//   • Para cada placeholder, sabemos label, máscara, origem (cliente|processo|
//     sistema), obrigatoriedade e grupo na UI.
//   • Aliases cobrem variações com/sem acento (ex.: [NUMERO FILIAÇÃO] e
//     [NUMERO FILIACAO] resolvem para a mesma key).
//   • Para `source = "cliente"`, `key` é a coluna em qa_clientes.
//   • Para `source = "processo"`, `key` é a chave dentro de
//     qa_processos.respostas_questionario_json.template_data.
// ============================================================================

export type PlaceholderSource = "cliente" | "processo" | "sistema";

export type PlaceholderInput =
  | "text"
  | "textarea"
  | "cpf"
  | "cnpj"
  | "cep"
  | "phone"
  | "date"
  | "email"
  | "uf"
  | "estado_civil"
  | "select";

export interface PlaceholderDef {
  /** Token literal que aparece no .docx, ex.: "[CELULAR]" */
  placeholder: string;
  /** Variações aceitas (com/sem acento, sinônimos). */
  aliases?: string[];
  /** Chave de persistência (coluna em qa_clientes ou key em template_data). */
  key: string;
  /** Rótulo amigável (PT-BR). */
  label: string;
  /** Pergunta exibida no wizard. */
  question?: string;
  /** Ajuda secundária. */
  helper?: string;
  source: PlaceholderSource;
  required: boolean;
  group: string;
  input: PlaceholderInput;
  /** Opções para inputs select. */
  options?: Array<{ value: string; label: string }>;
  /** Placeholder do input HTML. */
  inputPlaceholder?: string;
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

const ESTADOS_CIVIS: Array<{ value: string; label: string }> = [
  { value: "SOLTEIRO(A)", label: "SOLTEIRO(A)" },
  { value: "CASADO(A)", label: "CASADO(A)" },
  { value: "DIVORCIADO(A)", label: "DIVORCIADO(A)" },
  { value: "VIÚVO(A)", label: "VIÚVO(A)" },
  { value: "UNIÃO ESTÁVEL", label: "UNIÃO ESTÁVEL" },
];

const UFS: Array<{ value: string; label: string }> = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
].map((u) => ({ value: u, label: u }));

export const TEMPLATE_PLACEHOLDERS: PlaceholderDef[] = [
  // ---------------- CLIENTE: Identificação ----------------
  {
    placeholder: "[NOME COMPLETO]",
    key: "nome_completo",
    label: "NOME COMPLETO",
    question: "Qual é o seu nome completo?",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "text",
    inputPlaceholder: "NOME COMPLETO COMO NO RG",
  },
  {
    placeholder: "[CPF]",
    key: "cpf",
    label: "CPF",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "cpf",
    inputPlaceholder: "000.000.000-00",
  },
  {
    placeholder: "[RG]",
    key: "rg",
    label: "RG",
    question: "Qual é o número do seu RG?",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "text",
    inputPlaceholder: "00.000.000-0",
  },
  {
    placeholder: "[EMISSOR]",
    aliases: ["[ÓRGÃO EMISSOR]", "[ORGAO EMISSOR]", "[EMISSOR RG]"],
    key: "emissor_rg",
    label: "ÓRGÃO EMISSOR DO RG",
    question: "Qual o órgão emissor do seu RG?",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "text",
    inputPlaceholder: "EX.: SSP",
  },
  {
    placeholder: "[UF EMISSOR RG]",
    aliases: ["[UF EMISSOR]", "[UF DO EMISSOR]"],
    key: "uf_emissor_rg",
    label: "UF DO EMISSOR DO RG",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "uf",
    options: UFS,
  },
  {
    placeholder: "[EXPEDIÇÃO RG]",
    aliases: ["[EXPEDICAO RG]", "[DATA EXPEDIÇÃO RG]", "[DATA EXPEDICAO RG]", "[DATA DE EXPEDIÇÃO RG]"],
    key: "expedicao_rg",
    label: "DATA DE EXPEDIÇÃO DO RG",
    question: "Quando o seu RG foi expedido?",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "date",
    inputPlaceholder: "DD/MM/AAAA",
  },
  {
    placeholder: "[DATA NASCIMENTO]",
    aliases: ["[DATA DE NASCIMENTO]", "[NASCIMENTO]"],
    key: "data_nascimento",
    label: "DATA DE NASCIMENTO",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "date",
    inputPlaceholder: "DD/MM/AAAA",
  },
  {
    placeholder: "[NACIONALIDADE]",
    key: "nacionalidade",
    label: "NACIONALIDADE",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "text",
    inputPlaceholder: "BRASILEIRO(A)",
  },
  {
    placeholder: "[NATURALIDADE]",
    key: "naturalidade",
    label: "NATURALIDADE",
    question: "Em qual cidade/UF você nasceu?",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "text",
    inputPlaceholder: "EX.: SÃO PAULO/SP",
  },
  {
    placeholder: "[PROFISSÃO]",
    aliases: ["[PROFISSAO]"],
    key: "profissao",
    label: "PROFISSÃO",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "text",
    inputPlaceholder: "EX.: EMPRESÁRIO",
  },
  {
    placeholder: "[ESTADO CIVIL]",
    key: "estado_civil",
    label: "ESTADO CIVIL",
    source: "cliente",
    required: true,
    group: "Identificação",
    input: "estado_civil",
    options: ESTADOS_CIVIS,
  },

  // ---------------- CLIENTE: Contato ----------------
  {
    placeholder: "[CELULAR]",
    aliases: ["[TELEFONE]", "[FONE]", "[TELEFONE CELULAR]"],
    key: "celular",
    label: "CELULAR",
    source: "cliente",
    required: true,
    group: "Contato",
    input: "phone",
    inputPlaceholder: "(00) 00000-0000",
  },
  {
    placeholder: "[EMAIL]",
    aliases: ["[E-MAIL]"],
    key: "email",
    label: "E-MAIL",
    source: "cliente",
    required: false,
    group: "Contato",
    input: "email",
    inputPlaceholder: "seuemail@exemplo.com",
  },

  // ---------------- CLIENTE: Endereço ----------------
  {
    placeholder: "[ENDEREÇO 1]",
    aliases: ["[ENDERECO 1]", "[ENDEREÇO]", "[ENDERECO]"],
    key: "endereco",
    label: "ENDEREÇO COMPLETO",
    question: "Qual é o seu endereço completo (rua + número)?",
    source: "cliente",
    required: true,
    group: "Endereço",
    input: "text",
    inputPlaceholder: "RUA EXEMPLO, 123 — BAIRRO",
  },
  {
    placeholder: "[CIDADE]",
    key: "cidade",
    label: "CIDADE",
    source: "cliente",
    required: true,
    group: "Endereço",
    input: "text",
    inputPlaceholder: "CIDADE",
  },
  {
    placeholder: "[CEP]",
    key: "cep",
    label: "CEP",
    source: "cliente",
    required: true,
    group: "Endereço",
    input: "cep",
    inputPlaceholder: "00000-000",
  },
  {
    placeholder: "[ENDEREÇO 2]",
    aliases: ["[ENDERECO 2]"],
    key: "endereco2",
    label: "ENDEREÇO SECUNDÁRIO",
    source: "cliente",
    required: false,
    group: "Endereço",
    input: "text",
    inputPlaceholder: "Opcional",
  },

  // ---------------- PROCESSO / CLUBE ----------------
  {
    placeholder: "[NOME CLUBE]",
    aliases: ["[NOME DO CLUBE]"],
    key: "nome_clube",
    label: "NOME DO CLUBE",
    question: "Qual é o nome do clube de tiro?",
    source: "processo",
    required: true,
    group: "Clube de tiro",
    input: "text",
    inputPlaceholder: "EX.: CLUBE DE TIRO XYZ",
  },
  {
    placeholder: "[CNPJ CLUBE]",
    aliases: ["[CNPJ DO CLUBE]"],
    key: "cnpj_clube",
    label: "CNPJ DO CLUBE",
    source: "processo",
    required: true,
    group: "Clube de tiro",
    input: "cnpj",
    inputPlaceholder: "00.000.000/0000-00",
  },
  {
    placeholder: "[NUMERO CR CLUBE]",
    aliases: ["[NÚMERO CR CLUBE]", "[CR CLUBE]", "[NUMERO CR DO CLUBE]"],
    key: "numero_cr_clube",
    label: "NÚMERO DO CR DO CLUBE",
    source: "processo",
    required: true,
    group: "Clube de tiro",
    input: "text",
    inputPlaceholder: "EX.: 1234567",
  },
  {
    placeholder: "[DATA CR CLUBE]",
    aliases: ["[VALIDADE CR CLUBE]", "[DATA DO CR CLUBE]"],
    key: "data_cr_clube",
    label: "VALIDADE DO CR DO CLUBE",
    source: "processo",
    required: true,
    group: "Clube de tiro",
    input: "date",
    inputPlaceholder: "DD/MM/AAAA",
  },
  {
    placeholder: "[ENDERECO CLUBE]",
    aliases: ["[ENDEREÇO CLUBE]", "[ENDEREÇO DO CLUBE]"],
    key: "endereco_clube",
    label: "ENDEREÇO DO CLUBE",
    source: "processo",
    required: true,
    group: "Clube de tiro",
    input: "text",
    inputPlaceholder: "RUA, NÚMERO, BAIRRO, CIDADE/UF",
  },
  {
    placeholder: "[NUMERO FILIACAO]",
    aliases: ["[NÚMERO FILIAÇÃO]", "[NUMERO DE FILIACAO]", "[NÚMERO DE FILIAÇÃO]"],
    key: "numero_filiacao",
    label: "NÚMERO DE FILIAÇÃO AO CLUBE",
    source: "processo",
    required: true,
    group: "Clube de tiro",
    input: "text",
    inputPlaceholder: "EX.: 0001234",
  },
  {
    placeholder: "[VALIDADE FILIACAO]",
    aliases: ["[VALIDADE FILIAÇÃO]", "[VALIDADE DA FILIAÇÃO]"],
    key: "validade_filiacao",
    label: "VALIDADE DA FILIAÇÃO",
    source: "processo",
    required: true,
    group: "Clube de tiro",
    input: "date",
    inputPlaceholder: "DD/MM/AAAA",
  },

  // ---------------- SISTEMA (preenchimento automático) ----------------
  { placeholder: "[DIA]", key: "dia", label: "DIA", source: "sistema", required: false, group: "Sistema", input: "text" },
  { placeholder: "[MÊS]", aliases: ["[MES]"], key: "mes", label: "MÊS", source: "sistema", required: false, group: "Sistema", input: "text" },
  { placeholder: "[ANO]", key: "ano", label: "ANO", source: "sistema", required: false, group: "Sistema", input: "text" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normaliza um placeholder removendo acentos para matching tolerante. */
export function normalizePlaceholderToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Índice: token normalizado → PlaceholderDef
const PLACEHOLDER_INDEX: Map<string, PlaceholderDef> = (() => {
  const m = new Map<string, PlaceholderDef>();
  for (const p of TEMPLATE_PLACEHOLDERS) {
    m.set(normalizePlaceholderToken(p.placeholder), p);
    for (const a of p.aliases ?? []) {
      m.set(normalizePlaceholderToken(a), p);
    }
  }
  return m;
})();

/** Retorna a definição para um token (com ou sem acento, case-insensitive). */
export function findPlaceholder(token: string): PlaceholderDef | null {
  return PLACEHOLDER_INDEX.get(normalizePlaceholderToken(token)) ?? null;
}

const PLACEHOLDER_TOKEN_RE = /\[[A-Z0-9ÇÃÕÉÍÁÂÊÓÔÚÀÜÑ \-\/.]+\]/giu;

/** Extrai todos os tokens [XYZ] presentes numa string XML/texto. */
export function extractPlaceholderTokens(xml: string): string[] {
  const found = new Set<string>();
  const matches = xml.match(PLACEHOLDER_TOKEN_RE);
  if (!matches) return [];
  for (const m of matches) found.add(m);
  return Array.from(found);
}

export interface PlaceholderAuditEntry {
  token: string;
  def: PlaceholderDef | null;
}

/** Audita um template: token detectado + definição (ou null = desconhecido). */
export function auditTemplateXml(xml: string): PlaceholderAuditEntry[] {
  return extractPlaceholderTokens(xml).map((token) => ({
    token,
    def: findPlaceholder(token),
  }));
}

// ---------------------------------------------------------------------------
// Resolução de valores
// ---------------------------------------------------------------------------

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Resolve o valor atual de um placeholder (cliente | processo.template_data | sistema). */
export function resolvePlaceholderValue(
  def: PlaceholderDef,
  cliente: Record<string, any> | null | undefined,
  templateData: Record<string, any> | null | undefined,
): string {
  if (def.source === "sistema") {
    const now = new Date();
    if (def.key === "dia") return String(now.getDate()).padStart(2, "0");
    if (def.key === "mes") return MESES[now.getMonth()];
    if (def.key === "ano") return String(now.getFullYear());
    return "";
  }
  if (def.source === "processo") {
    return safeStr(templateData?.[def.key]);
  }
  // cliente
  if (def.key === "endereco") {
    const c = cliente || {};
    const parts = [c.endereco, c.numero ? `nº ${c.numero}` : "", c.complemento, c.bairro]
      .map(safeStr)
      .filter(Boolean);
    return parts.join(", ");
  }
  if (def.key === "endereco2") {
    const c = cliente || {};
    const parts = [c.endereco2, c.numero2 ? `nº ${c.numero2}` : "", c.complemento2, c.bairro2]
      .map(safeStr)
      .filter(Boolean);
    return parts.join(", ");
  }
  if (def.key === "naturalidade") {
    const c = cliente || {};
    const direct = safeStr(c.naturalidade);
    if (direct) return direct;
    const m = safeStr(c.naturalidade_municipio);
    const u = safeStr(c.naturalidade_uf);
    return [m, u].filter(Boolean).join("/");
  }
  return safeStr(cliente?.[def.key]);
}

/** Para um conjunto de placeholders presentes num template, devolve os faltantes. */
export function listMissingPlaceholders(
  presentTokens: string[],
  cliente: Record<string, any> | null | undefined,
  templateData: Record<string, any> | null | undefined,
): { missing: PlaceholderDef[]; unknown: string[] } {
  const missing: PlaceholderDef[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (const token of presentTokens) {
    const def = findPlaceholder(token);
    if (!def) {
      unknown.push(token);
      continue;
    }
    if (seen.has(def.key)) continue;
    seen.add(def.key);
    if (!def.required) continue;
    const val = resolvePlaceholderValue(def, cliente, templateData);
    if (!val) missing.push(def);
  }
  return { missing, unknown };
}

/**
 * Constrói o dicionário final de substituições para o motor de replace do
 * .docx. Sempre devolve uma string (vazia se faltar dado), e cobre todas as
 * variações de alias para que o XML não fique com token literal.
 */
export function buildReplacementsMap(
  cliente: Record<string, any> | null | undefined,
  templateData: Record<string, any> | null | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of TEMPLATE_PLACEHOLDERS) {
    const value = resolvePlaceholderValue(def, cliente, templateData);
    map[def.placeholder] = value;
    for (const a of def.aliases ?? []) map[a] = value;
  }
  // Compat: alguns templates antigos usam [NACIONALIDADE] esperando default brasileiro(a)
  if (!map["[NACIONALIDADE]"]) map["[NACIONALIDADE]"] = "brasileiro(a)";
  return map;
}
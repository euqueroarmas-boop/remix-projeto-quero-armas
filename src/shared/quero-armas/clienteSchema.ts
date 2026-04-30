/**
 * Schema compartilhado de cadastro de cliente — Quero Armas
 * Fonte única de verdade para QACadastroPublicoPage e ClienteFormModal.
 *
 * Regras:
 *  - Validação de campos obrigatórios por categoria do titular.
 *  - Validação CPF (11 dígitos válidos) e separação rigorosa CPF×RG.
 *  - Validação cruzada (formulário × documento extraído pela IA).
 *  - Status de confirmação para campos ambíguos.
 *
 * IMPORTANTE: Este arquivo NÃO deve ser importado por Edge Functions
 * (Deno). É exclusivo do frontend.
 */

import { z } from "zod";

/* ─── Categorias do titular (espelha categoriaTitular.ts) ─── */
export type CategoriaTitular =
  | "pessoa_fisica"
  | "pessoa_juridica"
  | "seguranca_publica"
  | "magistrado_mp"
  | "militar";

/* ─── Helpers ─── */
export function onlyDigits(v: string | null | undefined): string {
  return (v || "").replace(/\D/g, "");
}

/** Valida CPF brasileiro (algoritmo dos dígitos verificadores). */
export function isValidCpf(value: string | null | undefined): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

/** Valida e-mail simples. */
export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Telefone BR aceitável: 10 ou 11 dígitos. */
export function isValidTelefone(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

/** RG não pode coincidir com CPF (proteção CPF×RG). */
export function rgNotEqualCpf(rg: string | null | undefined, cpf: string | null | undefined): boolean {
  const r = onlyDigits(rg);
  const c = onlyDigits(cpf);
  if (!r || !c) return true;
  return r !== c;
}

/* ─── Tipo unificado dos dados do cliente ─── */
export interface ClienteData {
  // Identificação
  nome_completo: string;
  cpf: string;
  tipo_documento_identidade: "RG" | "CIN";
  rg: string;
  emissor_rg: string;
  data_expedicao_rg: string; // DD/MM/AAAA
  sexo: string;

  // Filiação e nascimento
  data_nascimento: string; // DD/MM/AAAA
  nome_mae: string;
  nome_pai: string;
  naturalidade_municipio: string;
  naturalidade_uf: string;
  naturalidade_pais: string;
  nacionalidade: string;
  estado_civil: string;

  // Documentos auxiliares
  titulo_eleitor: string;
  cnh: string;
  ctps: string;
  pis_pasep: string;

  // Contato
  email: string;
  telefone_principal: string;
  telefone_secundario: string;

  // Endereço residencial
  end1_cep: string;
  end1_logradouro: string;
  end1_numero: string;
  end1_complemento: string;
  end1_bairro: string;
  end1_cidade: string;
  end1_estado: string;
  end1_pais: string;

  // Profissional
  profissao: string;
  vinculo_tipo: string;

  // Categoria
  categoria_titular: CategoriaTitular | "";

  // LGPD
  consentimento_dados_verdadeiros: boolean;
  consentimento_tratamento_dados: boolean;
}

export const emptyClienteData: ClienteData = {
  nome_completo: "", cpf: "", tipo_documento_identidade: "RG", rg: "", emissor_rg: "", data_expedicao_rg: "", sexo: "",
  data_nascimento: "", nome_mae: "", nome_pai: "",
  naturalidade_municipio: "", naturalidade_uf: "", naturalidade_pais: "Brasil",
  nacionalidade: "Brasileira", estado_civil: "",
  titulo_eleitor: "", cnh: "", ctps: "", pis_pasep: "",
  email: "", telefone_principal: "", telefone_secundario: "",
  end1_cep: "", end1_logradouro: "", end1_numero: "", end1_complemento: "",
  end1_bairro: "", end1_cidade: "", end1_estado: "", end1_pais: "Brasil",
  profissao: "", vinculo_tipo: "",
  categoria_titular: "",
  consentimento_dados_verdadeiros: false,
  consentimento_tratamento_dados: false,
};

/* ─── Schema Zod base ─── */
const baseShape = {
  nome_completo: z.string().trim().min(3, "Informe o nome completo"),
  cpf: z.string().refine(isValidCpf, "CPF inválido"),
  tipo_documento_identidade: z.enum(["RG", "CIN"]).optional().default("RG"),
  rg: z.string().trim().optional().default(""),
  emissor_rg: z.string().trim().optional().default(""),
  data_expedicao_rg: z.string().trim().optional().default(""),
  sexo: z.string().trim().optional().default(""),

  data_nascimento: z.string().trim().optional().default(""),
  nome_mae: z.string().trim().optional().default(""),
  nome_pai: z.string().trim().optional().default(""),
  naturalidade_municipio: z.string().trim().optional().default(""),
  naturalidade_uf: z.string().trim().optional().default(""),
  naturalidade_pais: z.string().trim().optional().default(""),
  nacionalidade: z.string().trim().optional().default(""),
  estado_civil: z.string().trim().optional().default(""),

  titulo_eleitor: z.string().trim().optional().default(""),
  cnh: z.string().trim().optional().default(""),
  ctps: z.string().trim().optional().default(""),
  pis_pasep: z.string().trim().optional().default(""),

  email: z.string().refine(isValidEmail, "E-mail inválido"),
  telefone_principal: z.string().refine(isValidTelefone, "Telefone inválido"),
  telefone_secundario: z.string().trim().optional().default(""),

  end1_cep: z.string().trim().min(8, "CEP obrigatório"),
  end1_logradouro: z.string().trim().min(3, "Logradouro obrigatório"),
  end1_numero: z.string().trim().min(1, "Número obrigatório"),
  end1_complemento: z.string().trim().optional().default(""),
  end1_bairro: z.string().trim().min(2, "Bairro obrigatório"),
  end1_cidade: z.string().trim().min(2, "Cidade obrigatória"),
  end1_estado: z.string().trim().length(2, "UF obrigatória (2 letras)"),
  end1_pais: z.string().trim().optional().default("Brasil"),

  profissao: z.string().trim().optional().default(""),
  vinculo_tipo: z.string().trim().optional().default(""),

  categoria_titular: z
    .enum(["pessoa_fisica", "pessoa_juridica", "seguranca_publica", "magistrado_mp", "militar"])
    .or(z.literal("")),

  consentimento_dados_verdadeiros: z.boolean(),
  consentimento_tratamento_dados: z.boolean(),
};

export const clienteSchema = z.object(baseShape).superRefine((d, ctx) => {
  // CPF×RG não podem ser idênticos
  if (d.tipo_documento_identidade !== "CIN" && !rgNotEqualCpf(d.rg, d.cpf)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rg"],
      message: "RG não pode ser igual ao CPF — se for CIN, selecione CIN",
    });
  }
  // LGPD obrigatório
  if (!d.consentimento_dados_verdadeiros || !d.consentimento_tratamento_dados) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["consentimento_tratamento_dados"],
      message: "Aceite LGPD obrigatório",
    });
  }
});

/* ─── Matriz por categoria ─── */
/**
 * Conjunto de campos extras requeridos por categoria, ALÉM do baseline
 * (nome, cpf, email, telefone, endereço residencial completo, LGPD).
 * Para Segurança Pública / Magistrado / Militar mantemos requisitos
 * mínimos para preservar fluxos específicos já existentes.
 */
export function getCamposObrigatoriosPorCategoria(
  categoria: CategoriaTitular | "",
): (keyof ClienteData)[] {
  // Base sempre obrigatória (presente em todas categorias)
  const base: (keyof ClienteData)[] = [
    "nome_completo", "cpf", "email", "telefone_principal",
    "end1_cep", "end1_logradouro", "end1_numero", "end1_bairro",
    "end1_cidade", "end1_estado",
  ];

  switch (categoria) {
    case "pessoa_fisica":
      // Cidadão comum — lista cheia
      return [
        ...base,
        "rg", "emissor_rg", "data_nascimento",
        "nome_mae", "naturalidade_municipio", "naturalidade_uf",
        "estado_civil", "profissao",
      ];
    case "pessoa_juridica":
      return [...base, "rg", "emissor_rg", "data_nascimento"];
    case "seguranca_publica":
    case "magistrado_mp":
    case "militar":
      // Categorias com fluxo específico — não impomos novos campos
      return [...base, "rg", "emissor_rg"];
    case "":
    default:
      // Sem categoria definida ainda — exige base
      return base;
  }
}

/* ─── Erros bloqueantes (para travar o avanço) ─── */
export interface BlockingError {
  field: keyof ClienteData | "lgpd" | "ambiguidade_cpf_rg";
  label: string;
  message: string;
}

const FIELD_LABELS: Partial<Record<keyof ClienteData, string>> = {
  nome_completo: "Nome completo",
  cpf: "CPF",
  rg: "RG",
  emissor_rg: "Órgão emissor do RG",
  data_nascimento: "Data de nascimento",
  nome_mae: "Nome da mãe",
  naturalidade_municipio: "Município de nascimento",
  naturalidade_uf: "UF de nascimento",
  estado_civil: "Estado civil",
  profissao: "Profissão",
  email: "E-mail",
  telefone_principal: "Telefone",
  end1_cep: "CEP",
  end1_logradouro: "Logradouro",
  end1_numero: "Número",
  end1_bairro: "Bairro",
  end1_cidade: "Cidade",
  end1_estado: "UF",
};

export function getBlockingErrors(
  data: ClienteData,
  opts: {
    categoria?: CategoriaTitular | "";
    needsCpfRgConfirmation?: boolean;
    cpfRgConfirmed?: boolean;
    /**
     * Tipo do documento de identidade detectado pela IA. Quando "CIN"
     * (Carteira de Identidade Nacional / gov.br), o número nacional pode
     * legitimamente ser igual ao CPF — então a regra "CPF ≠ RG" é dispensada
     * e a confirmação manual CPF×RG/CIN passa a ser meramente informativa.
     */
    documentoIdentidadeTipo?: "CIN" | "RG" | "CNH" | string;
  } = {},
): BlockingError[] {
  const errs: BlockingError[] = [];
  const required = getCamposObrigatoriosPorCategoria(
    opts.categoria ?? data.categoria_titular,
  );

  for (const field of required) {
    const v = (data as any)[field];
    if (v === undefined || v === null || String(v).trim() === "") {
      errs.push({
        field,
        label: FIELD_LABELS[field] || String(field),
        message: "Campo obrigatório vazio",
      });
    }
  }

  // CPF inválido (formato)
  if (data.cpf && !isValidCpf(data.cpf)) {
    errs.push({ field: "cpf", label: "CPF", message: "CPF inválido" });
  }

  // E-mail inválido
  if (data.email && !isValidEmail(data.email)) {
    errs.push({ field: "email", label: "E-mail", message: "E-mail inválido" });
  }

  // Telefone inválido
  if (data.telefone_principal && !isValidTelefone(data.telefone_principal)) {
    errs.push({ field: "telefone_principal", label: "Telefone", message: "Telefone inválido" });
  }

  // CPF×RG idênticos
  const isCinDoc = String(opts.documentoIdentidadeTipo || data.tipo_documento_identidade || "").toUpperCase().includes("CIN");
  if (!isCinDoc && !rgNotEqualCpf(data.rg, data.cpf)) {
    errs.push({
      field: "ambiguidade_cpf_rg",
      label: "CPF × RG",
      message: "RG e CPF não podem ser iguais — confirme manualmente",
    });
  }

  // Confirmação CPF×RG pendente — dispensada para CIN (informativa).
  if (!isCinDoc && opts.needsCpfRgConfirmation && !opts.cpfRgConfirmed) {
    errs.push({
      field: "ambiguidade_cpf_rg",
      label: "CPF × RG",
      message: "Confirme manualmente os números de CPF e RG extraídos",
    });
  }

  // LGPD
  if (!data.consentimento_dados_verdadeiros || !data.consentimento_tratamento_dados) {
    errs.push({ field: "lgpd", label: "LGPD", message: "Aceite LGPD obrigatório" });
  }

  return errs;
}

/* ─── Comparação documento × formulário (divergências) ─── */
export interface Divergencia {
  field: keyof ClienteData;
  label: string;
  documento: string;
  formulario: string;
}

/**
 * Aponta divergências entre o que a IA extraiu do documento e o que está no
 * formulário. Comparação tolerante (case-insensitive, sem espaços extras,
 * dígitos puros para CPF/RG).
 */
export function getDivergencias(
  formulario: ClienteData,
  documento: Partial<ClienteData>,
): Divergencia[] {
  const out: Divergencia[] = [];
  const compareFields: (keyof ClienteData)[] = [
    "nome_completo", "cpf", "rg", "emissor_rg", "data_nascimento",
    "nome_mae", "nome_pai",
  ];

  const norm = (k: keyof ClienteData, v: any): string => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    if (k === "cpf" || k === "rg") return onlyDigits(s);
    return s.toLowerCase().replace(/\s+/g, " ");
  };

  for (const k of compareFields) {
    const docVal = (documento as any)[k];
    const formVal = (formulario as any)[k];
    if (!docVal || !formVal) continue;
    if (norm(k, docVal) !== norm(k, formVal)) {
      out.push({
        field: k,
        label: FIELD_LABELS[k] || String(k),
        documento: String(docVal),
        formulario: String(formVal),
      });
    }
  }
  return out;
}

/* ─── Detecção de ambiguidade CPF×RG vinda da IA ─── */
export interface CpfRgAmbiguity {
  hasAmbiguity: boolean;
  reason?: string;
  cpfCandidates: string[];
  rgCandidates: string[];
}

/**
 * Avalia o output da edge function `qa-extract-documents` em busca de
 * ambiguidade entre CPF e RG. Aceita os campos legados e os novos campos
 * `cpf_candidato` / `rg_candidato` / `needs_confirmation`.
 */
export function detectCpfRgAmbiguity(extracted: any | null | undefined): CpfRgAmbiguity {
  const out: CpfRgAmbiguity = { hasAmbiguity: false, cpfCandidates: [], rgCandidates: [] };
  if (!extracted) return out;

  const cpf = onlyDigits(extracted.cpf);
  const rg = onlyDigits(extracted.rg);

  if (Array.isArray(extracted.cpf_candidato)) {
    out.cpfCandidates = extracted.cpf_candidato.map(onlyDigits).filter(Boolean);
  } else if (extracted.cpf_candidato) {
    out.cpfCandidates = [onlyDigits(extracted.cpf_candidato)].filter(Boolean);
  }
  if (Array.isArray(extracted.rg_candidato)) {
    out.rgCandidates = extracted.rg_candidato.map(onlyDigits).filter(Boolean);
  } else if (extracted.rg_candidato) {
    out.rgCandidates = [onlyDigits(extracted.rg_candidato)].filter(Boolean);
  }

  if (extracted.needs_confirmation === true) {
    out.hasAmbiguity = true;
    out.reason = extracted.confirmation_reason || "A IA não conseguiu separar CPF e RG com certeza";
    return out;
  }

  if (cpf && rg && cpf === rg) {
    out.hasAmbiguity = true;
    out.reason = "CPF e RG retornaram idênticos pela IA";
    return out;
  }

  if (out.cpfCandidates.length > 1 || out.rgCandidates.length > 1) {
    out.hasAmbiguity = true;
    out.reason = "Múltiplos candidatos de CPF/RG encontrados";
  }

  return out;
}

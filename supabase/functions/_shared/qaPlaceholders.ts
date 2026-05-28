// ============================================================================
// _shared/qaPlaceholders.ts
// ----------------------------------------------------------------------------
// Espelho minimalista de src/lib/quero-armas/templatePlaceholders.ts, no runtime
// Deno. Mantém apenas o necessário para o guard server-side: detectar tokens no
// XML do .docx, identificar obrigatórios faltantes e construir o mapa de
// substituições. Qualquer ALTERAÇÃO de catálogo deve ser refletida nos dois
// arquivos (TS no front, TS aqui no edge).
// ============================================================================

export type PlaceholderSource = "cliente" | "processo" | "sistema";

export interface PlaceholderDef {
  placeholder: string;
  aliases?: string[];
  key: string;
  source: PlaceholderSource;
  required: boolean;
}

export const QA_PLACEHOLDERS: PlaceholderDef[] = [
  // cliente — identificação
  { placeholder: "[NOME COMPLETO]", key: "nome_completo", source: "cliente", required: true },
  { placeholder: "[CPF]", key: "cpf", source: "cliente", required: true },
  { placeholder: "[RG]", key: "rg", source: "cliente", required: true },
  { placeholder: "[EMISSOR]", aliases: ["[ÓRGÃO EMISSOR]", "[ORGAO EMISSOR]", "[EMISSOR RG]"], key: "emissor_rg", source: "cliente", required: true },
  { placeholder: "[UF EMISSOR RG]", aliases: ["[UF EMISSOR]", "[UF DO EMISSOR]"], key: "uf_emissor_rg", source: "cliente", required: true },
  { placeholder: "[EXPEDIÇÃO RG]", aliases: ["[EXPEDICAO RG]", "[DATA EXPEDIÇÃO RG]", "[DATA EXPEDICAO RG]", "[DATA DE EXPEDIÇÃO RG]"], key: "expedicao_rg", source: "cliente", required: true },
  { placeholder: "[DATA NASCIMENTO]", aliases: ["[DATA DE NASCIMENTO]", "[NASCIMENTO]"], key: "data_nascimento", source: "cliente", required: true },
  { placeholder: "[NACIONALIDADE]", key: "nacionalidade", source: "cliente", required: true },
  { placeholder: "[NATURALIDADE]", key: "naturalidade", source: "cliente", required: true },
  { placeholder: "[PROFISSÃO]", aliases: ["[PROFISSAO]"], key: "profissao", source: "cliente", required: true },
  { placeholder: "[ESTADO CIVIL]", key: "estado_civil", source: "cliente", required: true },
  // cliente — contato
  { placeholder: "[CELULAR]", aliases: ["[TELEFONE]", "[FONE]", "[TELEFONE CELULAR]"], key: "celular", source: "cliente", required: true },
  { placeholder: "[EMAIL]", aliases: ["[E-MAIL]"], key: "email", source: "cliente", required: false },
  // cliente — endereço
  { placeholder: "[ENDEREÇO 1]", aliases: ["[ENDERECO 1]", "[ENDEREÇO]", "[ENDERECO]"], key: "endereco", source: "cliente", required: true },
  { placeholder: "[CIDADE]", key: "cidade", source: "cliente", required: true },
  { placeholder: "[CEP]", key: "cep", source: "cliente", required: true },
  { placeholder: "[ENDEREÇO 2]", aliases: ["[ENDERECO 2]"], key: "endereco2", source: "cliente", required: false },
  // processo — clube
  { placeholder: "[NOME CLUBE]", aliases: ["[NOME DO CLUBE]"], key: "nome_clube", source: "processo", required: true },
  { placeholder: "[CNPJ CLUBE]", aliases: ["[CNPJ DO CLUBE]"], key: "cnpj_clube", source: "processo", required: true },
  { placeholder: "[NUMERO CR CLUBE]", aliases: ["[NÚMERO CR CLUBE]", "[CR CLUBE]", "[NUMERO CR DO CLUBE]"], key: "numero_cr_clube", source: "processo", required: true },
  { placeholder: "[DATA CR CLUBE]", aliases: ["[VALIDADE CR CLUBE]", "[DATA DO CR CLUBE]"], key: "data_cr_clube", source: "processo", required: true },
  { placeholder: "[ENDERECO CLUBE]", aliases: ["[ENDEREÇO CLUBE]", "[ENDEREÇO DO CLUBE]"], key: "endereco_clube", source: "processo", required: true },
  { placeholder: "[NUMERO FILIACAO]", aliases: ["[NÚMERO FILIAÇÃO]", "[NUMERO DE FILIACAO]", "[NÚMERO DE FILIAÇÃO]"], key: "numero_filiacao", source: "processo", required: true },
  { placeholder: "[VALIDADE FILIACAO]", aliases: ["[VALIDADE FILIAÇÃO]", "[VALIDADE DA FILIAÇÃO]"], key: "validade_filiacao", source: "processo", required: true },
  // sistema
  { placeholder: "[DIA]", key: "dia", source: "sistema", required: false },
  { placeholder: "[MÊS]", aliases: ["[MES]"], key: "mes", source: "sistema", required: false },
  { placeholder: "[ANO]", key: "ano", source: "sistema", required: false },
];

export function normalizePlaceholderToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const INDEX: Map<string, PlaceholderDef> = (() => {
  const m = new Map<string, PlaceholderDef>();
  for (const p of QA_PLACEHOLDERS) {
    m.set(normalizePlaceholderToken(p.placeholder), p);
    for (const a of p.aliases ?? []) m.set(normalizePlaceholderToken(a), p);
  }
  return m;
})();

export function findPlaceholder(token: string): PlaceholderDef | null {
  return INDEX.get(normalizePlaceholderToken(token)) ?? null;
}

const TOKEN_RE = /\[[A-Z0-9ÇÃÕÉÍÁÂÊÓÔÚÀÜÑ \-\/.]+\]/giu;

export function extractPlaceholderTokens(xml: string): string[] {
  const set = new Set<string>();
  const m = xml.match(TOKEN_RE);
  if (m) for (const t of m) set.add(t);
  return Array.from(set);
}

const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];

// Uppercase pt-BR preservando números, pontuação e entidades XML.
export function upperPtBR(input: string): string {
  if (!input) return input;
  return input.replace(/&[a-zA-Z#0-9]+;|[\p{L}]/gu, (m) => {
    if (m.startsWith("&")) return m; // não mexer em entidades XML
    return m.toLocaleUpperCase("pt-BR");
  });
}

function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function resolveValue(
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
  if (def.source === "processo") return s(templateData?.[def.key]);
  const c = cliente || {};
  if (def.key === "endereco") {
    const parts = [c.endereco, c.numero ? `nº ${c.numero}` : "", c.complemento, c.bairro].map(s).filter(Boolean);
    return parts.join(", ");
  }
  if (def.key === "endereco2") {
    const parts = [c.endereco2, c.numero2 ? `nº ${c.numero2}` : "", c.complemento2, c.bairro2].map(s).filter(Boolean);
    return parts.join(", ");
  }
  if (def.key === "naturalidade") {
    const direct = s(c.naturalidade);
    if (direct) return direct;
    return [s(c.naturalidade_municipio), s(c.naturalidade_uf)].filter(Boolean).join("/");
  }
  return s(c[def.key]);
}

export function buildReplacementsMap(
  cliente: Record<string, any> | null | undefined,
  templateData: Record<string, any> | null | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of QA_PLACEHOLDERS) {
    const v = resolveValue(def, cliente, templateData);
    map[def.placeholder] = v;
    for (const a of def.aliases ?? []) map[a] = v;
  }
  if (!map["[NACIONALIDADE]"]) map["[NACIONALIDADE]"] = "brasileiro(a)";
  // Padrão visual obrigatório: todos os valores substituídos saem em CAIXA ALTA pt-BR.
  for (const k of Object.keys(map)) map[k] = upperPtBR(map[k] ?? "");
  return map;
}

// ---------------------------------------------------------------------------
// Pós-processamento do XML do .docx:
//  1) Uppercase pt-BR de todo conteúdo textual dentro de <w:t>...</w:t>
//     (cobre tanto texto fixo do template quanto valores já substituídos).
//  2) Inserção de ~5 parágrafos vazios antes da linha de assinatura
//     (parágrafo cujo texto contém ≥10 underscores seguidos).
// Não altera estrutura/tags do OOXML.
// ---------------------------------------------------------------------------
export function postProcessDocxXml(xml: string): string {
  // 1) Uppercase em <w:t>
  let out = xml.replace(
    /(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g,
    (_m, open: string, content: string, close: string) =>
      open + upperPtBR(content) + close,
  );

  // 2) Espaçamento antes da assinatura
  const EMPTY_P = `<w:p/>`.repeat(5);
  out = out.replace(
    /(<w:p\b[^>]*>[\s\S]*?<\/w:p>)/g,
    (full) => {
      // detecta texto agregado do parágrafo
      const text = (full.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) ?? [])
        .map((t) => t.replace(/<[^>]+>/g, ""))
        .join("");
      if (/_{10,}/.test(text)) {
        return EMPTY_P + full;
      }
      return full;
    },
  );

  return out;
}

export interface AuditResult {
  required_missing: Array<{ token: string; key: string; source: PlaceholderSource }>;
  unknown: string[];
}

export function auditTemplate(
  xml: string,
  cliente: Record<string, any> | null | undefined,
  templateData: Record<string, any> | null | undefined,
): AuditResult {
  const tokens = extractPlaceholderTokens(xml);
  const required_missing: AuditResult["required_missing"] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const def = findPlaceholder(token);
    if (!def) { unknown.push(token); continue; }
    if (!def.required) continue;
    if (seen.has(def.key)) continue;
    seen.add(def.key);
    const v = resolveValue(def, cliente, templateData);
    if (!v) required_missing.push({ token: def.placeholder, key: def.key, source: def.source });
  }
  return { required_missing, unknown };
}
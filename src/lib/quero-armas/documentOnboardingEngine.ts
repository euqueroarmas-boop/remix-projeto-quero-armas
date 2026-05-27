// ============================================================================
// documentOnboardingEngine.ts
// ----------------------------------------------------------------------------
// Helpers do "Assistente de Cadastro Documental" (Wizard KYC):
//   - Probe contra `qa-fill-template-cliente` (modo `probe: true`)
//   - Persistência por origem (cliente | processo)
//   - Sugestões da IA a partir de qa_processo_documentos.dados_extraidos_json
//
// Fonte única de placeholders: src/lib/quero-armas/templatePlaceholders.ts.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import {
  findPlaceholder,
  PlaceholderDef,
  TEMPLATE_PLACEHOLDERS,
} from "@/lib/quero-armas/templatePlaceholders";
import {
  effectiveOrder,
  mergeOverride,
  OverridesMap,
} from "@/lib/quero-armas/templatePlaceholderOverrides";

export interface ProbeResult {
  ok: boolean;
  missing_placeholders: Array<{ token: string; key: string; source: string }>;
  unknown_placeholders: string[];
}

export interface FillTemplateError extends Error {
  status: number;
  missing_placeholders: ProbeResult["missing_placeholders"];
  unknown_placeholders: string[];
}

async function authHeaders(): Promise<{ token: string; base: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  return { token, base };
}

/** Faz o probe (não gera o .docx) e devolve o relatório. */
export async function probeTemplate(params: {
  templateKey: string;
  processoId: string;
}): Promise<ProbeResult> {
  const { token, base } = await authHeaders();
  const resp = await fetch(`${base}/functions/v1/qa-fill-template-cliente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      template_key: params.templateKey,
      processo_id: params.processoId,
      probe: true,
    }),
  });
  if (!resp.ok) {
    let payload: any = null;
    try { payload = await resp.json(); } catch { /* ignore */ }
    throw new Error(payload?.error || `Falha ao consultar modelo (${resp.status})`);
  }
  const data = await resp.json();
  return {
    ok: !!data?.ok,
    missing_placeholders: Array.isArray(data?.missing_placeholders) ? data.missing_placeholders : [],
    unknown_placeholders: Array.isArray(data?.unknown_placeholders) ? data.unknown_placeholders : [],
  };
}

/** Gera o arquivo final. Em 422 lança FillTemplateError com listas. */
export async function generateTemplateBlob(params: {
  templateKey: string;
  processoId: string;
}): Promise<Blob> {
  const { token, base } = await authHeaders();
  const resp = await fetch(`${base}/functions/v1/qa-fill-template-cliente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      template_key: params.templateKey,
      processo_id: params.processoId,
    }),
  });

  if (resp.status === 422) {
    let payload: any = null;
    try { payload = await resp.json(); } catch { /* ignore */ }
    const err = new Error("Faltam dados obrigatórios.") as FillTemplateError;
    err.status = 422;
    err.missing_placeholders = Array.isArray(payload?.missing_placeholders)
      ? payload.missing_placeholders : [];
    err.unknown_placeholders = Array.isArray(payload?.unknown_placeholders)
      ? payload.unknown_placeholders : [];
    throw err;
  }
  if (!resp.ok) {
    let payload: any = null;
    try { payload = await resp.json(); } catch { /* ignore */ }
    throw new Error(payload?.error || `Falha ao gerar documento (${resp.status})`);
  }
  const blob = await resp.blob();
  if (!blob || blob.size < 200) {
    throw new Error("Documento gerado veio vazio. Tente novamente em alguns instantes.");
  }
  return blob;
}

/** Salva uma resposta do wizard na origem certa (cliente ou processo). */
export async function saveWizardAnswer(params: {
  processoId: string;
  def: PlaceholderDef;
  value: string;
}): Promise<void> {
  const { processoId, def, value } = params;
  const v = (value ?? "").trim();
  if (!v) return;
  const { token, base } = await authHeaders();

  if (def.source === "cliente") {
    const resp = await fetch(`${base}/functions/v1/qa-cliente-atualizar-cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: { [def.key]: v } }),
    });
    if (!resp.ok) {
      let payload: any = null;
      try { payload = await resp.json(); } catch { /* ignore */ }
      throw new Error(payload?.error || `Não foi possível salvar (${resp.status})`);
    }
    return;
  }

  if (def.source === "processo") {
    const resp = await fetch(`${base}/functions/v1/qa-processo-template-data-salvar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        processo_id: processoId,
        template_data: { [def.key]: v },
      }),
    });
    if (!resp.ok) {
      let payload: any = null;
      try { payload = await resp.json(); } catch { /* ignore */ }
      throw new Error(payload?.error || `Não foi possível salvar (${resp.status})`);
    }
    return;
  }
}

export interface WizardStep {
  def: PlaceholderDef;
  initialValue: string;
  iaSuggestion?: string;
}

export function buildWizardSteps(params: {
  missing: ProbeResult["missing_placeholders"];
  cliente: Record<string, any> | null;
  templateData: Record<string, any> | null;
  iaSuggestions: Record<string, string>;
  overrides?: OverridesMap;
}): WizardStep[] {
  const { missing, cliente, templateData, iaSuggestions, overrides } = params;
  const seen = new Set<string>();
  const steps: WizardStep[] = [];
  for (const m of missing) {
    const baseDef = findPlaceholder(m.token) ?? findPlaceholderByKey(m.key);
    if (!baseDef) continue;
    if (seen.has(baseDef.key)) continue;
    seen.add(baseDef.key);
    const ov = overrides?.[baseDef.placeholder] ?? null;
    const def = mergeOverride(baseDef, ov);
    const initialValue =
      def.source === "cliente"
        ? safeStr(cliente?.[def.key])
        : def.source === "processo"
          ? safeStr(templateData?.[def.key])
          : "";
    steps.push({ def, initialValue, iaSuggestion: iaSuggestions[def.key] });
  }
  // Reordena por `ordem` do override quando informado.
  steps.sort((a, b) => {
    const oa = overrides?.[a.def.placeholder] ?? null;
    const ob = overrides?.[b.def.placeholder] ?? null;
    return effectiveOrder(a.def, oa) - effectiveOrder(b.def, ob);
  });
  return steps;
}

function findPlaceholderByKey(key: string): PlaceholderDef | null {
  return TEMPLATE_PLACEHOLDERS.find((p) => p.key === key) ?? null;
}

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// ---------------------------------------------------------------------------
// Sugestões IA
// ---------------------------------------------------------------------------

const IA_KEY_ALIASES: Record<string, string[]> = {
  rg: ["rg", "numero_rg"],
  emissor_rg: ["emissor_rg", "orgao_emissor", "emissor"],
  uf_emissor_rg: ["uf_emissor_rg", "uf_emissor"],
  expedicao_rg: ["expedicao_rg", "data_expedicao_rg", "data_expedicao"],
  data_nascimento: ["data_nascimento", "nascimento"],
  nacionalidade: ["nacionalidade"],
  naturalidade: ["naturalidade", "naturalidade_completa"],
  profissao: ["profissao"],
  estado_civil: ["estado_civil"],
  celular: ["celular", "telefone"],
  endereco: ["endereco", "logradouro"],
  cidade: ["cidade", "municipio"],
  cep: ["cep"],
  nome_clube: ["nome_clube", "clube"],
  cnpj_clube: ["cnpj_clube", "cnpj"],
  numero_cr_clube: ["numero_cr_clube", "cr_clube", "numero_cr"],
  data_cr_clube: ["data_cr_clube", "validade_cr_clube"],
  endereco_clube: ["endereco_clube"],
  numero_filiacao: ["numero_filiacao", "filiacao"],
  validade_filiacao: ["validade_filiacao"],
};

export async function loadIaSuggestions(processoId: string): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from("qa_processo_documentos")
      .select("dados_extraidos_json")
      .eq("processo_id", processoId);
    if (error || !data) return {};
    const merged: Record<string, string> = {};
    for (const row of data) {
      const src = (row as any)?.dados_extraidos_json;
      if (!src || typeof src !== "object") continue;
      for (const [key, aliases] of Object.entries(IA_KEY_ALIASES)) {
        if (merged[key]) continue;
        for (const a of aliases) {
          const v = src[a];
          if (v && typeof v === "string" && v.trim()) {
            merged[key] = v.trim();
            break;
          }
        }
      }
    }
    return merged;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Máscaras
// ---------------------------------------------------------------------------

export function maskValue(input: string, kind: PlaceholderDef["input"]): string {
  const v = (input ?? "").toString();
  switch (kind) {
    case "cpf": {
      const d = v.replace(/\D/g, "").slice(0, 11);
      return d
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    case "cnpj": {
      const d = v.replace(/\D/g, "").slice(0, 14);
      return d
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    case "cep": {
      const d = v.replace(/\D/g, "").slice(0, 8);
      return d.replace(/(\d{5})(\d)/, "$1-$2");
    }
    case "phone": {
      const d = v.replace(/\D/g, "").slice(0, 11);
      if (d.length <= 10) {
        return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
      }
      return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
    }
    case "date": {
      const d = v.replace(/\D/g, "").slice(0, 8);
      return d
        .replace(/^(\d{2})(\d)/, "$1/$2")
        .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
    }
    case "uf":
      return v.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
    default:
      return v.toUpperCase();
  }
}

export function isValueValid(value: string, def: PlaceholderDef): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  switch (def.input) {
    case "cpf": return v.replace(/\D/g, "").length === 11;
    case "cnpj": return v.replace(/\D/g, "").length === 14;
    case "cep": return v.replace(/\D/g, "").length === 8;
    case "phone": return v.replace(/\D/g, "").length >= 10;
    case "date": return /^\d{2}\/\d{2}\/\d{4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v);
    case "uf": return /^[A-Z]{2}$/.test(v);
    case "email": return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
    default: return v.length > 0;
  }
}

/** CPF/E-mail/Nome completo são bloqueados pelo backend — wizard direciona para suporte. */
export const FIELDS_NEEDING_SUPPORT = new Set<string>(["cpf", "email", "nome_completo"]);

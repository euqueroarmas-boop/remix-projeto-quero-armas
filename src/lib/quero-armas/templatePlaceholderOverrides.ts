// ============================================================================
// templatePlaceholderOverrides.ts
// ----------------------------------------------------------------------------
// Loader + merge dos OVERRIDES editáveis pela equipe sobre o catálogo técnico
// de placeholders (templatePlaceholders.ts).
//
// Filosofia:
//   • Catálogo técnico (placeholder, key, source, input/máscara) é IMUTÁVEL no
//     código — garante que o motor de preenchimento do .docx nunca quebre.
//   • Tabela `qa_template_placeholder_config` guarda APENAS texto/UX:
//     pergunta, ajuda, exemplo, label, grupo, ordem, obrigatório opcional.
//   • Se não houver linha (ou ativo=false), usamos o fallback do código.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import { PlaceholderDef, TEMPLATE_PLACEHOLDERS } from "@/lib/quero-armas/templatePlaceholders";

export interface PlaceholderOverride {
  id?: string;
  placeholder: string;
  label_cliente?: string | null;
  pergunta_cliente?: string | null;
  texto_ajuda?: string | null;
  exemplo_placeholder?: string | null;
  grupo_visual?: string | null;
  ordem?: number | null;
  obrigatorio_override?: boolean | null;
  ativo?: boolean;
  updated_at?: string;
}

export type OverridesMap = Record<string, PlaceholderOverride>;

/** Carrega todos os overrides ativos. Em erro, devolve {} (fallback total). */
export async function loadPlaceholderOverrides(): Promise<OverridesMap> {
  try {
    const { data, error } = await supabase
      .from("qa_template_placeholder_config" as any)
      .select("*")
      .eq("ativo", true);
    if (error || !Array.isArray(data)) return {};
    const map: OverridesMap = {};
    for (const row of data as any[]) {
      if (row?.placeholder) map[row.placeholder] = row as PlaceholderOverride;
    }
    return map;
  } catch {
    return {};
  }
}

/** Aplica um override a um def técnico, mantendo campos não sobrescritos. */
export function mergeOverride(def: PlaceholderDef, ov?: PlaceholderOverride | null): PlaceholderDef {
  if (!ov) return def;
  const out: PlaceholderDef = { ...def };
  if (ov.label_cliente && ov.label_cliente.trim()) out.label = ov.label_cliente.trim();
  if (ov.pergunta_cliente && ov.pergunta_cliente.trim()) out.question = ov.pergunta_cliente.trim();
  if (ov.texto_ajuda && ov.texto_ajuda.trim()) out.helper = ov.texto_ajuda.trim();
  if (ov.exemplo_placeholder && ov.exemplo_placeholder.trim()) out.inputPlaceholder = ov.exemplo_placeholder.trim();
  if (ov.grupo_visual && ov.grupo_visual.trim()) out.group = ov.grupo_visual.trim();
  if (typeof ov.obrigatorio_override === "boolean") out.required = ov.obrigatorio_override;
  return out;
}

/** Ordem efetiva para o wizard: ov.ordem se houver, senão posição no catálogo. */
export function effectiveOrder(def: PlaceholderDef, ov?: PlaceholderOverride | null): number {
  if (ov && typeof ov.ordem === "number" && Number.isFinite(ov.ordem)) return ov.ordem;
  const idx = TEMPLATE_PLACEHOLDERS.findIndex((p) => p.key === def.key);
  return idx >= 0 ? idx : 9999;
}
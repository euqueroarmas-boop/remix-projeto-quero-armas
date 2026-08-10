// ============================================================================
// regrasCategoria
// ----------------------------------------------------------------------------
// Fonte única da matriz "Categoria × Exigência" (public.qa_regras_categoria).
//
// Para cada exigência do checklist, dada a categoria/corporação do titular, o
// motor responde uma de três coisas:
//
//   exigido      → passo normal, o cliente entrega o documento
//   alternativo  → passo normal, mas aceita a via institucional
//   dispensado   → passo aparece já cumprido, com carimbo + base legal
//
// E, no nível do titular, um marcador de sistema de registro (SINARM x SIGMA)
// que sinaliza quando o cliente está no serviço errado (militar da ativa não
// registra arma no SINARM — registra no SIGMA do Exército).
//
// Nada é chumbado: a base legal exibida ao cliente vem da linha da matriz,
// gerenciada em Configurações → Dispensas e exigências por categoria.
// ============================================================================

export type ModoExigencia = "exigido" | "alternativo" | "dispensado";
export type SistemaRegistro = "sinarm" | "sigma";

export interface RegraCategoria {
  id?: string;
  servico_id: number | null;
  categoria: string;
  corporacao: string | null;
  grupo_id: string;
  tipo_documento: string | null;
  modo: ModoExigencia;
  base_legal: string | null;
  registro: SistemaRegistro | null;
  ativo: boolean;
}

export interface ContextoTitular {
  servicoId?: number | string | null;
  categoria?: string | null;
  corporacao?: string | null;
}

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/**
 * Especificidade: quanto mais campos a regra amarra, mais forte ela é.
 * serviço (8) > corporação (4) > tipo_documento (2) > grupo (1)
 */
function peso(r: RegraCategoria): number {
  let p = 1;
  if (r.servico_id != null) p += 8;
  if (r.corporacao) p += 4;
  if (r.tipo_documento) p += 2;
  return p;
}

function casa(r: RegraCategoria, ctx: ContextoTitular, grupoId: string, tipoDocumento?: string | null): boolean {
  if (!r.ativo) return false;
  if (norm(r.categoria) !== norm(ctx.categoria)) return false;
  if (r.servico_id != null && String(r.servico_id) !== String(ctx.servicoId ?? "")) return false;
  if (r.corporacao && norm(r.corporacao) !== norm(ctx.corporacao)) return false;
  if (r.tipo_documento && norm(r.tipo_documento) !== norm(tipoDocumento)) return false;
  if (norm(r.grupo_id) !== norm(grupoId)) return false;
  return true;
}

export interface ResultadoRegra {
  modo: ModoExigencia;
  base_legal: string | null;
  regra: RegraCategoria | null;
}

export function resolverRegra(
  regras: RegraCategoria[] | null | undefined,
  ctx: ContextoTitular,
  grupoId: string,
  tipoDocumento?: string | null,
): ResultadoRegra {
  if (!ctx?.categoria || !Array.isArray(regras) || regras.length === 0) {
    return { modo: "exigido", base_legal: null, regra: null };
  }
  const candidatas = regras.filter((r) => casa(r, ctx, grupoId, tipoDocumento));
  if (candidatas.length === 0) return { modo: "exigido", base_legal: null, regra: null };
  const vencedora = candidatas.sort((a, b) => peso(b) - peso(a))[0];
  return { modo: vencedora.modo, base_legal: vencedora.base_legal ?? null, regra: vencedora };
}

/**
 * Sistema de registro do titular. Qualquer linha ativa da categoria que declare
 * `registro` responde — a mais específica vence.
 */
export function registroDoTitular(
  regras: RegraCategoria[] | null | undefined,
  ctx: ContextoTitular,
): { sistema: SistemaRegistro | null; base_legal: string | null } {
  if (!ctx?.categoria || !Array.isArray(regras)) return { sistema: null, base_legal: null };
  const cand = regras
    .filter((r) => r.ativo && r.registro && norm(r.categoria) === norm(ctx.categoria))
    .filter((r) => !r.corporacao || norm(r.corporacao) === norm(ctx.corporacao))
    .filter((r) => r.servico_id == null || String(r.servico_id) === String(ctx.servicoId ?? ""))
    .sort((a, b) => peso(b) - peso(a));
  const v = cand[0];
  return { sistema: (v?.registro as SistemaRegistro) ?? null, base_legal: v?.base_legal ?? null };
}

// ─── Rascunho sugerido (não aplicado automaticamente) ────────────────────────
// A equipe revisa e ativa linha a linha em Configurações. Enquanto a tabela
// estiver vazia, nada é dispensado — o comportamento continua o de hoje.
export const MATRIZ_RASCUNHO: Omit<RegraCategoria, "id">[] = [
  {
    servico_id: null,
    categoria: "seguranca_publica",
    corporacao: null,
    grupo_id: "laudos",
    tipo_documento: null,
    modo: "alternativo",
    base_legal: "Lei 10.826/03, art. 6º, §1º-A — aferição feita pela própria corporação",
    registro: "sinarm",
    ativo: false,
  },
  {
    servico_id: null,
    categoria: "magistrado_mp",
    corporacao: null,
    grupo_id: "laudos",
    tipo_documento: null,
    modo: "dispensado",
    base_legal: "LC 35/79, art. 33, V (LOMAN) e Lei 8.625/93, art. 42",
    registro: "sinarm",
    ativo: false,
  },
  {
    servico_id: null,
    categoria: "militar",
    corporacao: null,
    grupo_id: "arma",
    tipo_documento: null,
    modo: "exigido",
    base_legal: "Registro no SIGMA (Exército) — Decreto 11.615/23",
    registro: "sigma",
    ativo: false,
  },
];

export const MODOS: { valor: ModoExigencia; label: string; ajuda: string }[] = [
  { valor: "exigido", label: "EXIGIDO", ajuda: "Passo normal — o cliente entrega o documento." },
  { valor: "alternativo", label: "ALTERNATIVO", ajuda: "Aceita a via institucional (laudo da própria corporação)." },
  { valor: "dispensado", label: "DISPENSADO", ajuda: "Passo aparece já cumprido, com carimbo e base legal." },
];

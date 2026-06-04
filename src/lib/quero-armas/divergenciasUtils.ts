/**
 * Helpers para limpar "ruído" de divergências em documentos aprovados.
 *
 * Divergência vazia: { campo, esperado: "", encontrado: "" } — não tem valor
 * comparativo e NÃO deve bloquear nem aparecer na UI. Esses registros são
 * sobra de validações antigas; documento aprovado/validado sem valores reais
 * em ambos os lados é tratado como sem divergência.
 */

const STATUS_LIMPEZA_AGRESSIVA = new Set([
  "aprovado",
  "validado",
  "dispensado",
  "dispensado_grupo",
  "dispensado_por_reaproveitamento",
  "nao_aplicavel",
  "concluido",
]);

function ehVazio(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

export interface DivergenciaItem {
  campo?: string;
  esperado?: unknown;
  encontrado?: unknown;
  [k: string]: unknown;
}

/**
 * Remove divergências em que `esperado` e `encontrado` estão ambos vazios.
 * Para documentos com status na lista de "limpeza agressiva", também aplica
 * a regra: se NÃO houver pelo menos um dos lados preenchido, descarta.
 */
export function limparDivergenciasVazias<T extends DivergenciaItem>(
  divergencias: T[] | null | undefined,
  status?: string | null,
): T[] {
  if (!Array.isArray(divergencias) || divergencias.length === 0) return [];
  const s = String(status || "").toLowerCase();
  const aprovado = STATUS_LIMPEZA_AGRESSIVA.has(s);
  return divergencias.filter((d) => {
    const e = (d as any)?.esperado;
    const f = (d as any)?.encontrado;
    const eVazio = ehVazio(e);
    const fVazio = ehVazio(f);
    if (eVazio && fVazio) return false;
    if (aprovado && (eVazio || fVazio)) {
      // Em doc aprovado, divergência só vale se AMBOS os lados estiverem
      // preenchidos e realmente diferentes. Um lado vazio = ruído.
      return false;
    }
    return true;
  });
}
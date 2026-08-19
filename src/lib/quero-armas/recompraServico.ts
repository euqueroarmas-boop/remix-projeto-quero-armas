/**
 * Trava de compra repetida do checkout.
 *
 * `qa-checkout-criar-venda` recusa (HTTP 409, `servico_ja_contratado`) em dois
 * casos, e só neles:
 *
 *   repeticao_em_minutos → o mesmo serviço foi comprado há menos de 30 minutos.
 *                          É acidente (não viu a confirmação e refez), não
 *                          escolha.
 *   limite_do_servico    → a compra estouraria o limite cadastrado em
 *                          `qa_servicos_limite_compra` para a categoria do
 *                          titular (posse: 2 para cidadão comum, 4 para
 *                          segurança pública). Serviço sem limite não trava.
 *
 * Quem fecha o carrinho decide: reenviar com `recompra_confirmada: true` cria
 * a venda mesmo assim e deixa a decisão registrada.
 *
 * Este módulo guarda o vocabulário compartilhado pelas três telas que criam
 * venda (checkout do cliente, Piloto Real e Central de Adesão).
 */

export const ERRO_SERVICO_JA_CONTRATADO = "servico_ja_contratado";

export type MotivoRecusaCompra = "repeticao_em_minutos" | "limite_do_servico";

export interface RecusaCompra {
  motivo: MotivoRecusaCompra;
  servico_id: number;
  servico_slug: string;
  servico_nome: string;
  ja_tem: number;
  no_carrinho: number;
  limite: number | null;
  venda_id: number;
  minutos_desde_a_ultima: number;
}

/** O que o front lê de um erro de edge function: o corpo JSON, sem tipo fixo. */
export type CorpoErro = Record<string, unknown> | null;

/** Corpo JSON de um erro de edge function (a mensagem do SDK é genérica). */
export async function corpoDoErroFn(err: unknown): Promise<CorpoErro> {
  try {
    const ctx = (err as { context?: { json?: () => Promise<unknown> } })?.context;
    if (ctx && typeof ctx.json === "function") {
      return (await ctx.json()) as Record<string, unknown>;
    }
  } catch { /* corpo não-JSON */ }
  return null;
}

export function ehRecompraBloqueada(body: CorpoErro): boolean {
  return !!body && body.error === ERRO_SERVICO_JA_CONTRATADO;
}

export function listaRecusas(body: CorpoErro): RecusaCompra[] {
  const bruto = body?.servicos;
  return Array.isArray(bruto) ? (bruto as RecusaCompra[]) : [];
}

export function motivoRecusa(body: CorpoErro): MotivoRecusaCompra | null {
  const doCorpo = body?.motivo;
  if (doCorpo === "repeticao_em_minutos" || doCorpo === "limite_do_servico") return doCorpo;
  return listaRecusas(body)[0]?.motivo ?? null;
}

/** Frase única, já explicando por que cada serviço foi barrado. */
export function resumoRecompra(body: CorpoErro): string {
  const vistos = new Set<number>();
  const partes: string[] = [];
  for (const r of listaRecusas(body)) {
    if (vistos.has(r.servico_id)) continue;
    vistos.add(r.servico_id);
    if (r.motivo === "repeticao_em_minutos") {
      const min = Math.max(0, Number(r.minutos_desde_a_ultima) || 0);
      partes.push(
        `${r.servico_nome} (comprado há ${min === 0 ? "menos de 1 minuto" : `${min} min`}, venda #${r.venda_id})`,
      );
    } else {
      partes.push(`${r.servico_nome} (já tem ${r.ja_tem}, limite ${r.limite ?? "—"})`);
    }
  }
  return partes.join(" · ");
}

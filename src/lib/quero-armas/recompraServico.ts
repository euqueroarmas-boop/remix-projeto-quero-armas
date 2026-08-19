/**
 * Proteção contra compra repetida por engano.
 *
 * `qa-checkout-criar-venda` recusa (HTTP 409, `compra_repetida_agora`) quando o
 * mesmo serviço já foi comprado nos últimos 30 minutos. Não é limite de compra
 * — quantas armas o cliente pode ter é assunto do órgão, não do checkout. É só
 * a proteção contra o clique repetido de quem não viu a confirmação do
 * pagamento e refez o pedido.
 *
 * Quem está comprando desfaz sozinho: reenviar com `recompra_confirmada: true`
 * cria a venda e deixa a confirmação registrada. Ninguém precisa pedir
 * autorização à Equipe.
 *
 * Vocabulário compartilhado pelas três telas que criam venda (checkout do
 * cliente, Piloto Real e Central de Adesão).
 */

export const ERRO_COMPRA_REPETIDA = "compra_repetida_agora";

export interface CompraRecente {
  servico_id: number;
  servico_nome: string;
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

export function ehCompraRepetida(body: CorpoErro): boolean {
  return !!body && body.error === ERRO_COMPRA_REPETIDA;
}

export function listaComprasRecentes(body: CorpoErro): CompraRecente[] {
  const bruto = body?.servicos;
  return Array.isArray(bruto) ? (bruto as CompraRecente[]) : [];
}

/** Frase única dizendo o que já foi comprado e há quanto tempo. */
export function resumoCompraRepetida(body: CorpoErro): string {
  const vistos = new Set<number>();
  const partes: string[] = [];
  for (const c of listaComprasRecentes(body)) {
    if (vistos.has(c.servico_id)) continue;
    vistos.add(c.servico_id);
    const min = Math.max(0, Number(c.minutos_desde_a_ultima) || 0);
    partes.push(
      `${c.servico_nome} (há ${min === 0 ? "menos de 1 minuto" : `${min} min`}, venda #${c.venda_id})`,
    );
  }
  return partes.join(" · ");
}

/** Pergunta feita a quem está comprando — a decisão é dele, não da Equipe. */
export function perguntaCompraRepetida(body: CorpoErro): string {
  return (
    `Você já comprou isto agora há pouco: ${resumoCompraRepetida(body)}.\n\n` +
    "Se o pagamento anterior não apareceu, não é preciso comprar de novo — ele pode estar a caminho.\n\n" +
    "Quer mesmo fazer uma nova compra?"
  );
}

/**
 * Trava de compra duplicada do checkout.
 *
 * `qa-checkout-criar-venda` recusa (HTTP 409, `servico_ja_contratado`) uma
 * venda cujo carrinho traz serviço que o cliente já tem em venda viva. Quem
 * fecha o carrinho decide: se for mesmo uma nova solicitação (segunda arma,
 * por exemplo), reenvia com `recompra_confirmada: true`.
 *
 * Este módulo guarda o vocabulário compartilhado pelas três telas que criam
 * venda (checkout do cliente, Piloto Real e Central de Adesão).
 */

export const ERRO_SERVICO_JA_CONTRATADO = "servico_ja_contratado";

export interface RecompraServico {
  servico_id: number;
  servico_nome: string;
  venda_id: number;
  venda_status: string;
  contratada_em: string | null;
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

export function listaRecompras(body: CorpoErro): RecompraServico[] {
  const bruto = body?.servicos;
  return Array.isArray(bruto) ? (bruto as RecompraServico[]) : [];
}

/** Frase única listando o que já foi contratado, sem repetir serviço. */
export function resumoRecompra(body: CorpoErro): string {
  const vistos = new Set<string>();
  const partes: string[] = [];
  for (const r of listaRecompras(body)) {
    const chave = `${r.servico_nome}#${r.venda_id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    partes.push(`${r.servico_nome} (venda #${r.venda_id})`);
  }
  return partes.join(" · ");
}

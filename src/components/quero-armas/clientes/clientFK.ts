/**
 * Helpers de chave canônica para vinculação cliente↔venda↔item no Quero Armas.
 *
 * REGRA APROVADA:
 *  - qa_vendas.cliente_id  → referencia qa_clientes.id_legado
 *  - qa_itens_venda.venda_id → referencia qa_vendas.id_legado
 *  - qa_itens_venda.cliente_id → referencia qa_clientes.id_legado
 *
 * Sempre que `id_legado` for nulo, fazemos fallback para `id` (registros novos sem legado).
 *
 * EXCEÇÃO: qa_exames_cliente.cliente_id usa `qa_clientes.id` puro (não migrado).
 */

export interface HasIds { id: number; id_legado?: number | null }

/** FK do cliente para vincular vendas/itens/crafs/gtes/cr/filiações. */
export function getClienteFK(c: HasIds | null | undefined): number {
  if (!c) return 0;
  return (typeof c.id_legado === "number" && Number.isFinite(c.id_legado)) ? c.id_legado : c.id;
}

/** FK da venda para vincular itens. */
export function getVendaFK(v: HasIds | null | undefined): number {
  if (!v) return 0;
  return (typeof v.id_legado === "number" && Number.isFinite(v.id_legado)) ? v.id_legado : v.id;
}

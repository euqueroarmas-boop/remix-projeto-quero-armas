/**
 * Helpers de chave canônica para vinculação cliente↔venda↔item no Quero Armas.
 *
 * REGRA APROVADA (atualizada):
 *  - qa_vendas.cliente_id  → referencia qa_clientes.id_legado
 *  - qa_itens_venda.venda_id → referencia qa_vendas.id_legado
 *  - qa_itens_venda.cliente_id → referencia qa_clientes.id_legado
 *
 * Sempre que `id_legado` for nulo, fazemos fallback para `id` (registros novos sem legado).
 *
 * EXCEÇÕES (sempre `qa_clientes.id` real, normalizado em backfill):
 *   - qa_exames_cliente.cliente_id
 *   - qa_cadastro_cr.cliente_id
 *   - qa_crafs.cliente_id
 *   - qa_gtes.cliente_id
 *   - qa_filiacoes.cliente_id
 *   - cliente_auth_links.qa_cliente_id
 *   Use `getClienteCadastroFK()` para essas tabelas (Aba CR / Arsenal / Portal).
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

/**
 * FK do cliente para tabelas de CADASTRO/ARSENAL/PORTAL — sempre `qa_clientes.id` real.
 * Use para: qa_cadastro_cr, qa_crafs, qa_gtes, qa_filiacoes, qa_exames_cliente,
 * cliente_auth_links.qa_cliente_id e cargas via portal do cliente.
 *
 * As RLS dessas tabelas usam `qa_current_cliente_id(auth.uid())` que retorna o id real
 * de `cliente_auth_links.qa_cliente_id`. Apontar para id_legado fazia o portal "não ver" o CR.
 */
export function getClienteCadastroFK(c: HasIds | null | undefined): number {
  if (!c) return 0;
  return c.id;
}

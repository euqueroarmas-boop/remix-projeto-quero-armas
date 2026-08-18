// ============================================================================
// prazoItemVenda — escrever data de prazo no item certo da venda
// ----------------------------------------------------------------------------
// O motor de prazos (`prazosProcessuais.ts`) não lê `qa_processos`: ele lê datas
// em `qa_itens_venda`. Quem move o processo tem que escrever lá, ou o painel de
// prazos continua mostrando a realidade anterior.
//
// ── A PONTE QUE PEGA TODO MUNDO DESPREVENIDO ────────────────────────────────
// `qa_processos.venda_id` aponta para `qa_vendas.id` (o id real). Já
// `qa_itens_venda.venda_id` aponta para `qa_vendas.id_legado`. Comparar os dois
// direto FUNCIONA na maioria dos clientes — os que nasceram sem legado, em que
// os dois números são iguais — e falha em silêncio exatamente nos vindos do
// sistema antigo. É o pior formato de bug: passa no teste com dado novo e
// quebra só no cliente antigo.
//
// ── POR QUE NUNCA DERRUBA A OPERAÇÃO ────────────────────────────────────────
// O número do protocolo, o deferimento, a resposta à notificação: esses são o
// dado que não pode se perder. A data do prazo é leitura derivada e se corrige
// depois. Por isso o retorno é `{ ok, aviso }` e nunca uma exceção — quem chama
// devolve o aviso para a equipe conferir.
//
// NOTA: `qa-processo-deferir` e `qa-recurso-protocolar` ainda carregam a cópia
// desta lógica inline. Elas estão publicadas e funcionando; migrá-las agora
// obrigaria a republicar duas funções que ninguém pediu para mexer. Quando uma
// delas for tocada por outro motivo, troque pela chamada daqui.
// ============================================================================

export interface ResultadoPrazo {
  /** A data chegou no item da venda? */
  ok: boolean;
  /** Por que não chegou. `null` quando deu certo. */
  aviso: string | null;
}

/**
 * Grava uma data de prazo no item da venda correspondente ao processo.
 *
 * @param coluna Nome da coluna de data em `qa_itens_venda`.
 * @param data   Data em ISO (YYYY-MM-DD).
 */
export async function gravarPrazoNoItem(
  // deno-lint-ignore no-explicit-any
  admin: any,
  args: { processoId: string; coluna: string; data: string },
): Promise<ResultadoPrazo> {
  try {
    const { data: processo } = await admin
      .from("qa_processos")
      .select("venda_id, servico_id")
      .eq("id", args.processoId)
      .maybeSingle();

    const vendaId = (processo as { venda_id?: number | null } | null)?.venda_id ?? null;
    const servicoId = (processo as { servico_id?: number | null } | null)?.servico_id ?? null;
    if (!vendaId || !servicoId) {
      return { ok: false, aviso: "Processo sem venda/serviço: o prazo não foi lançado." };
    }

    const { data: venda } = await admin
      .from("qa_vendas")
      .select("id, id_legado")
      .eq("id", vendaId)
      .maybeSingle();
    const v = venda as { id: number; id_legado?: number | null } | null;
    const fkVenda = v
      ? (typeof v.id_legado === "number" && Number.isFinite(v.id_legado) ? v.id_legado : v.id)
      : null;
    if (!fkVenda) {
      return { ok: false, aviso: "Venda do processo não encontrada: o prazo não foi lançado." };
    }

    const { data: atualizados, error } = await admin
      .from("qa_itens_venda")
      .update({ [args.coluna]: args.data })
      .eq("venda_id", fkVenda)
      .eq("servico_id", servicoId)
      .select("id");

    if (error) return { ok: false, aviso: `Prazo não lançado: ${error.message}` };
    if (!atualizados || atualizados.length === 0) {
      return {
        ok: false,
        aviso: "Nenhum item desta venda corresponde ao serviço: o prazo não foi lançado.",
      };
    }
    return { ok: true, aviso: null };
  } catch (e) {
    return { ok: false, aviso: `Prazo não lançado: ${e instanceof Error ? e.message : "erro"}` };
  }
}

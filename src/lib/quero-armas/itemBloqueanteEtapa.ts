// ============================================================================
// itemBloqueanteEtapa
// ----------------------------------------------------------------------------
// Helper canônico que decide se um documento/pergunta-pivot ainda BLOQUEIA a
// liberação automática da próxima etapa do checklist. Usado tanto no frontend
// (drawer / portal) quanto na edge `qa-processo-etapa-auto-liberar` (via
// paridade lógica). Mantém os mesmos status canônicos de cumprimento usados
// em `checklistMetrics.ts` e em `etapasAutoLiberacao.ts`.
//
// Regra:
//   bloqueante = obrigatório E aplicável E ainda não cumprido.
//
// NÃO bloqueia quando:
//   - status cumprido (aprovado/validado/concluido/dispensado*/nao_aplicavel/
//     hub_reaproveitado)
//   - pergunta-pivot com resposta presente em respostas_questionario_json
//   - item oculto por condição não satisfeita (regra_validacao.condicional)
//   - item não obrigatório
// ============================================================================

export interface ItemDoc {
  id?: string | number;
  status?: string | null;
  obrigatorio?: boolean | null;
  tipo_documento?: string | null;
  regra_validacao?: any;
}

export interface ContextoBloqueio {
  respostas?: Record<string, any> | null;
  docsDoProcesso?: ItemDoc[];
}

const STATUS_CUMPRIDO = new Set([
  "aprovado",
  "validado",
  "concluido",
  "concluído",
  "dispensado",
  "dispensado_grupo",
  "dispensado_por_reaproveitamento",
  "nao_aplicavel",
  "hub_reaproveitado",
]);

export function isStatusCumprido(status: string | null | undefined): boolean {
  return STATUS_CUMPRIDO.has(String(status ?? "").trim().toLowerCase());
}

export function isPerguntaPivot(doc: ItemDoc): boolean {
  const tipoRegra = doc?.regra_validacao?.tipo;
  if (tipoRegra === "pergunta") return true;
  const t = String(doc?.tipo_documento ?? "").toLowerCase();
  return t.startsWith("pergunta_");
}

export function perguntaPivotRespondida(
  doc: ItemDoc,
  respostas: Record<string, any> | null | undefined,
): boolean {
  const chave = doc?.regra_validacao?.chave as string | undefined;
  if (!chave) return false;
  const v = (respostas ?? {})[chave];
  return v !== undefined && v !== null && v !== "";
}

/**
 * Item oculto por condição não satisfeita.
 * `regra_validacao.condicional` pode aparecer como:
 *   { depende_de: "<chave>", valor: "<valor>" | string[] }
 * Se a chave existe e o valor da resposta NÃO bate, o item é considerado
 * oculto (não bloqueia etapa).
 */
export function itemOcultoPorCondicao(
  doc: ItemDoc,
  respostas: Record<string, any> | null | undefined,
): boolean {
  const cond = doc?.regra_validacao?.condicional;
  if (!cond || typeof cond !== "object") return false;
  const chave = cond.depende_de as string | undefined;
  if (!chave) return false;
  const respondido = (respostas ?? {})[chave];
  // Sem resposta para a condição: item ainda não é aplicável → não bloqueia.
  if (respondido === undefined || respondido === null || respondido === "") return true;
  if (cond.valor === undefined) return false;
  if (Array.isArray(cond.valor)) {
    return !cond.valor.map(String).includes(String(respondido));
  }
  return String(cond.valor) !== String(respondido);
}

export function isItemBloqueanteParaLiberacaoEtapa(
  doc: ItemDoc,
  ctx: ContextoBloqueio = {},
): boolean {
  if (!doc) return false;
  if (doc.obrigatorio === false) return false;
  const respostas = ctx.respostas ?? {};

  // Condição não satisfeita → item não aplicável → não bloqueia.
  if (itemOcultoPorCondicao(doc, respostas)) return false;

  // Pergunta-pivot: cumprida se já respondida no JSON do processo, mesmo
  // que o status do documento esteja dessincronizado no banco.
  if (isPerguntaPivot(doc)) {
    if (perguntaPivotRespondida(doc, respostas)) return false;
    if (isStatusCumprido(doc.status)) return false;
    return true;
  }

  if (isStatusCumprido(doc.status)) return false;
  return true;
}

/**
 * Retorna apenas os itens que ainda bloqueiam a liberação da etapa, dados
 * todos os documentos da etapa atual.
 */
export function itensBloqueantes(
  docsEtapa: ItemDoc[],
  ctx: ContextoBloqueio = {},
): ItemDoc[] {
  return (docsEtapa || []).filter((d) => isItemBloqueanteParaLiberacaoEtapa(d, ctx));
}
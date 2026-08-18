// ============================================================================
// O STATUS FANTASMA — `em_revisao_humana` nunca existiu no banco
// ----------------------------------------------------------------------------
// Achado da QUARTA auditoria (18/08/2026), e é o mais caro da série.
//
// Quando a IA não tem confiança para decidir sozinha, ela manda o documento
// para conferência humana. O status que ela grava é **`revisao_humana`** — em
// `qa-processo-doc-validar-ia` e em `_shared/popularArsenalAprovado.ts`, sem
// exceção. `em_revisao_humana` (com o prefixo) NUNCA é escrito por código
// nenhum, em lugar nenhum.
//
// E a FILA DE CONFERÊNCIA da equipe — a tela em que se revisa exatamente isso —
// filtrava `status = 'em_revisao_humana'`. Ou seja: **estava vazia por
// construção, desde sempre.**
//
// ── POR QUE ISSO PASSOU TANTO TEMPO ─────────────────────────────────────────
// Porque o dicionário de exibição (`statusDocumento.ts`) traduz as DUAS
// grafias para "em análise". Então o documento aparecia certo em toda tela que
// mostra rótulo — no processo, no portal do cliente, no Hub. O erro só existia
// onde alguém comparava a STRING CRUA, e comparação crua não tem rótulo para
// denunciar.
//
// ── O QUE ISSO CAUSAVA, NA PRÁTICA ──────────────────────────────────────────
// Um documento em `revisao_humana` fica num ponto cego perfeito:
//
//   • o CLIENTE não o vê como pendência (o portal conta `revisao_humana` como
//     resolvido — e está certo, a bola não é dele);
//   • a EQUIPE não o vê na fila de conferência (a fila estava vazia);
//   • mas o checador de conclusão o considera NÃO cumprido, então o processo
//     nunca vira `pronto_para_protocolar`.
//
// Ninguém tem o que fazer e o processo não anda. O único jeito de descobrir era
// alguém abrir o processo certo e olhar documento por documento.
//
// ── A REGRA DAQUI PARA A FRENTE ─────────────────────────────────────────────
// Nenhuma tela compara status de revisão humana por string crua. Usa-se
// `ehRevisaoHumana` ou `STATUS_REVISAO_HUMANA` (para o `.in()` do Supabase),
// que aceitam as duas grafias. O teste `statusRevisaoHumanaSemFantasma` varre o
// código e falha se uma comparação crua voltar.
//
// Vale para DOCUMENTO e para PROCESSO: os dois vocabulários têm o mesmo par de
// grafias, pela mesma razão histórica (`STATUS_PROCESSO_LEGADO`).
// ============================================================================

/**
 * As duas grafias, para usar em `.in("status", ...)` do Supabase.
 *
 * A real é a primeira. A segunda entra porque telas antigas e registros de
 * auditoria carregam a string, e uma fila que ignora metade do vocabulário é
 * pior do que uma fila que traz um caso a mais.
 */
export const STATUS_REVISAO_HUMANA: readonly string[] = [
  "revisao_humana",
  "em_revisao_humana",
];

/** O documento/processo está esperando conferência de uma pessoa? */
export function ehRevisaoHumana(status: string | null | undefined): boolean {
  return STATUS_REVISAO_HUMANA.includes(String(status ?? "").trim().toLowerCase());
}

/**
 * Status em que o documento está NAS MÃOS DA IA, esperando o robô terminar.
 *
 * Diferente de revisão humana: aqui ninguém precisa fazer nada — a não ser que
 * a validação tenha morrido no meio. Ver `ehTravadoNaIA`.
 */
export const STATUS_EM_VALIDACAO_IA: readonly string[] = [
  "em_analise",
  "enviado",
  "fila",
  "processando",
];

/** Minutos após os quais uma validação de IA em curso deixa de ser normal. */
export const MINUTOS_LIMITE_VALIDACAO_IA = 15;

/**
 * A validação da IA travou?
 *
 * `qa-processo-doc-validar-ia` marca `em_analise` + `validacao_ia_status =
 * 'processando'` ANTES de chamar o modelo. Se o runtime derruba a função por
 * tempo (PDF grande, modelo lento), o `catch` que mandaria o documento para
 * revisão humana nunca roda — e a linha fica `processando` para sempre.
 *
 * Nesse estado o documento cai no MESMO ponto cego do status fantasma: o
 * cliente o vê como resolvido, a equipe não o vê em fila nenhuma, e o processo
 * não avança. Por isso a fila de conferência passa a mostrá-lo também.
 *
 * O corte é por tempo porque não existe outro sinal: a função morta não deixa
 * recado.
 */
export function ehTravadoNaIA(
  doc: { status?: string | null; validacao_ia_status?: string | null; updated_at?: string | null },
  agora: Date = new Date(),
): boolean {
  const st = String(doc.status ?? "").trim().toLowerCase();
  const ia = String(doc.validacao_ia_status ?? "").trim().toLowerCase();
  if (!STATUS_EM_VALIDACAO_IA.includes(st)) return false;
  // `erro` e `concluido` já foram tratados pela própria função.
  if (ia !== "processando" && ia !== "fila") return false;
  const t = doc.updated_at ? new Date(doc.updated_at).getTime() : NaN;
  if (!Number.isFinite(t)) return false;
  return agora.getTime() - t > MINUTOS_LIMITE_VALIDACAO_IA * 60_000;
}

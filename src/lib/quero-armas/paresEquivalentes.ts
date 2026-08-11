// ============================================================================
// PARES EQUIVALENTES DE LAUDO — "laudos são 2, nunca 4"
// ----------------------------------------------------------------------------
// Cada exigência de laudo tem DUAS vias de cumprimento:
//   • particular  → laudo de profissional credenciado pela PF   (CANÔNICO)
//   • instituição → atestado emitido pela instituição do cliente (IRMÃO)
//
// As duas vias são EQUIVALENTES: entregar uma dispensa a outra
// (registrado em qa_tipo_documento_aliases). Elas NÃO são exigências
// diferentes — são caminhos da mesma exigência. Por isso o checklist deve
// mostrar e contar apenas o item canônico; a escolha da via acontece dentro
// do item, nunca como item novo.
//
// Regra do usuário (11/08/2026): "laudos são apenas 2, nunca 4 itens. A
// escolha se o cliente vai mandar pela instituição ou particular não pode
// contar como laudos."
// ============================================================================

/** irmão institucional → tipo canônico do par */
export const PAR_LAUDO_CANONICO: Record<string, string> = {
  atestado_aptidao_psicologica_instituicao: "laudo_psicologico",
  atestado_capacidade_tecnica_instituicao: "laudo_capacidade_tecnica",
};

/** tipo canônico → irmão institucional */
export const PAR_LAUDO_IRMAO: Record<string, string> = Object.fromEntries(
  Object.entries(PAR_LAUDO_CANONICO).map(([irmao, canonico]) => [canonico, irmao]),
);

function norm(tipo: string | null | undefined): string {
  return String(tipo ?? "").trim().toLowerCase();
}

export function ehIrmaoInstitucional(tipo: string | null | undefined): boolean {
  return norm(tipo) in PAR_LAUDO_CANONICO;
}

/** Devolve o tipo canônico do par (o próprio tipo quando não faz parte de par). */
export function tipoCanonicoLaudo(tipo: string | null | undefined): string {
  const t = norm(tipo);
  return PAR_LAUDO_CANONICO[t] ?? t;
}

/** Os dois tipos pertencem à MESMA exigência de laudo? */
export function mesmaExigenciaLaudo(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ca = tipoCanonicoLaudo(a);
  const cb = tipoCanonicoLaudo(b);
  return !!ca && ca === cb;
}

/**
 * Colapsa pares equivalentes numa lista de documentos de checklist.
 *
 * Mantém sempre UMA linha por exigência de laudo. Quando as duas linhas do par
 * existem, sobrevive a que representa melhor o estado real da exigência:
 * cumprida > em análise > canônica (particular) > institucional. Assim o
 * cliente nunca vê "pendente" numa exigência que já foi entregue pela outra
 * via, nem vê o mesmo laudo cobrado duas vezes.
 *
 * Não muta a lista de entrada e preserva a ordem original.
 */
export function colapsarParesLaudo<T>(
  docs: T[],
  getTipo: (doc: T) => string | null | undefined,
  opts?: {
    cumprido?: (doc: T) => boolean;
    emAnalise?: (doc: T) => boolean;
  },
): T[] {
  const peso = (d: T): number => {
    if (opts?.cumprido?.(d)) return 3;
    if (opts?.emAnalise?.(d)) return 2;
    return ehIrmaoInstitucional(getTipo(d)) ? 0 : 1;
  };

  // Escolhe o representante de cada par.
  const melhorPorPar = new Map<string, T>();
  for (const d of docs) {
    const t = norm(getTipo(d));
    if (!t) continue;
    const canonico = tipoCanonicoLaudo(t);
    if (canonico !== t || PAR_LAUDO_IRMAO[t]) {
      const atual = melhorPorPar.get(canonico);
      if (!atual || peso(d) > peso(atual)) melhorPorPar.set(canonico, d);
    }
  }

  return docs.filter((d) => {
    const t = norm(getTipo(d));
    if (!t) return true;
    const canonico = tipoCanonicoLaudo(t);
    const representante = melhorPorPar.get(canonico);
    if (!representante) return true; // não faz parte de par
    return representante === d;
  });
}
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
 * Mantém sempre UMA linha por exigência de laudo:
 *  • se existir a linha canônica, o irmão institucional é removido;
 *  • se só existir o irmão institucional (processos antigos), ele permanece,
 *    representando o par — nunca deixamos a exigência sumir.
 *
 * Não muta nem reordena a lista de entrada.
 */
export function colapsarParesLaudo<T>(
  docs: T[],
  getTipo: (doc: T) => string | null | undefined,
): T[] {
  const canonicosPresentes = new Set(
    docs.map((d) => norm(getTipo(d))).filter((t) => t && !ehIrmaoInstitucional(t)),
  );
  const jaVisto = new Set<string>();
  return docs.filter((d) => {
    const t = norm(getTipo(d));
    if (!t) return true;
    const canonico = tipoCanonicoLaudo(t);
    if (canonico === t && !PAR_LAUDO_IRMAO[t]) return true; // não faz parte de par
    if (ehIrmaoInstitucional(t) && canonicosPresentes.has(canonico)) return false;
    if (jaVisto.has(canonico)) return false;
    jaVisto.add(canonico);
    return true;
  });
}
// ============================================================================
// Checklist Guiado — Bus de eventos (camada NOVA, aditiva)
// ----------------------------------------------------------------------------
// Permite que qualquer botão na Área do Cliente abra o assistente guiado sem
// precisar passar props pelo portal inteiro (QAClientePortalPage tem ~1900
// linhas). Zero regressão: não altera nada existente, apenas adiciona um
// canal de comunicação simples baseado em listeners.
//
// PAYLOAD OPCIONAL (aditivo):
//   - processoId: abre o assistente já focado neste processo (pula seleção).
//   - focusDocId: tenta abrir direto neste documento (ex: pendência clicada).
// Sem payload, o comportamento é o legado (cliente escolhe o processo).
// ============================================================================

export interface AbrirChecklistPayload {
  processoId?: string | null;
  focusDocId?: string | null;
}

type Listener = (payload?: AbrirChecklistPayload) => void;

const listeners = new Set<Listener>();

/** Dispara a abertura do assistente de checklist guiado. */
export function abrirChecklistGuiado(payload?: AbrirChecklistPayload): void {
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* noop — um listener com erro nunca derruba os demais */
    }
  });
}

/** Registra um listener (usado pelo orquestrador ChecklistGuiado). Retorna unsubscribe. */
export function onAbrirChecklistGuiado(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

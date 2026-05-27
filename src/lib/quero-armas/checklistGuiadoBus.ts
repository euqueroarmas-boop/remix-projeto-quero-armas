// ============================================================================
// Checklist Guiado — Bus de eventos (camada NOVA, aditiva)
// ----------------------------------------------------------------------------
// Permite que qualquer botão na Área do Cliente abra o assistente guiado sem
// precisar passar props pelo portal inteiro (QAClientePortalPage tem ~1900
// linhas). Zero regressão: não altera nada existente, apenas adiciona um
// canal de comunicação simples baseado em listeners.
// ============================================================================

type Listener = () => void;

const listeners = new Set<Listener>();

/** Dispara a abertura do assistente de checklist guiado. */
export function abrirChecklistGuiado(): void {
  listeners.forEach((fn) => {
    try {
      fn();
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

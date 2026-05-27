// ============================================================================
// documentAssistantProgress — persistência leve (localStorage) do ponto onde
// o cliente parou no Assistente de Documentação.
// ----------------------------------------------------------------------------
// Camada ADITIVA. Não cria tabela, não muda RLS. Chave por cliente + processo
// (ou serviço/venda como fallback). Sempre revalidamos contra a fila real ao
// abrir, então um documento já aprovado nunca é "retomado" indevidamente.
// ============================================================================

export interface DocAssistantProgressKey {
  clienteId?: number | string | null;
  clienteIdLegado?: number | string | null;
  processoId?: string | null;
  vendaId?: string | number | null;
  serviceSlug?: string | null;
}

export interface DocAssistantProgress {
  clienteId: number | string | null;
  clienteIdLegado: number | string | null;
  processoId: string | null;
  vendaId: string | number | null;
  serviceSlug: string | null;
  currentDocumentId: string | null;
  currentDocumentKey: string | null; // tipo_documento (estável caso o id mude)
  currentIndex: number | null;
  updatedAt: string;
}

const PREFIX = "qa_doc_assistant_progress";

export function getDocumentAssistantProgressKey(k: DocAssistantProgressKey): string | null {
  const cli = k.clienteId ?? k.clienteIdLegado ?? null;
  const scope = k.processoId ?? k.vendaId ?? k.serviceSlug ?? null;
  if (cli == null || scope == null) return null;
  return `${PREFIX}:${cli}:${scope}`;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadDocumentAssistantProgress(
  k: DocAssistantProgressKey,
): DocAssistantProgress | null {
  const key = getDocumentAssistantProgressKey(k);
  const st = safeStorage();
  if (!key || !st) return null;
  try {
    const raw = st.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DocAssistantProgress;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDocumentAssistantProgress(
  k: DocAssistantProgressKey,
  payload: Partial<DocAssistantProgress>,
): void {
  const key = getDocumentAssistantProgressKey(k);
  const st = safeStorage();
  if (!key || !st) return;
  try {
    const next: DocAssistantProgress = {
      clienteId: k.clienteId ?? null,
      clienteIdLegado: k.clienteIdLegado ?? null,
      processoId: k.processoId ?? null,
      vendaId: k.vendaId ?? null,
      serviceSlug: k.serviceSlug ?? null,
      currentDocumentId: payload.currentDocumentId ?? null,
      currentDocumentKey: payload.currentDocumentKey ?? null,
      currentIndex: payload.currentIndex ?? null,
      updatedAt: new Date().toISOString(),
    };
    st.setItem(key, JSON.stringify(next));
  } catch {
    /* silencioso — persistência é best-effort */
  }
}

export function clearDocumentAssistantProgress(k: DocAssistantProgressKey): void {
  const key = getDocumentAssistantProgressKey(k);
  const st = safeStorage();
  if (!key || !st) return;
  try {
    st.removeItem(key);
  } catch {
    /* noop */
  }
}

/**
 * Resolve o documento de retomada a partir de uma fila já recalculada.
 * - 1. documento salvo (por id) ainda na fila;
 * - 2. documento salvo (por tipo_documento) ainda na fila;
 * - 3. primeiro da fila.
 * Retorna `null` se a fila estiver vazia.
 */
export function resolveResumeDocId<
  T extends { id: string; tipo_documento?: string | null },
>(fila: T[], saved: DocAssistantProgress | null): string | null {
  if (!fila.length) return null;
  if (saved) {
    if (saved.currentDocumentId) {
      const byId = fila.find((d) => d.id === saved.currentDocumentId);
      if (byId) return byId.id;
    }
    if (saved.currentDocumentKey) {
      const byKey = fila.find(
        (d) => (d.tipo_documento ?? "").toLowerCase() === saved.currentDocumentKey!.toLowerCase(),
      );
      if (byKey) return byKey.id;
    }
  }
  return fila[0].id;
}
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

// ============================================================================
// RETOMADA DO CHECKLIST GUIADO — "voltei e está tudo como eu deixei"
// ----------------------------------------------------------------------------
// Mesma ideia das funções acima, num escopo maior. A fila do checklist guiado
// (PendenciasGuiadasPopup) atravessa processos, então a chave é só o cliente.
// Guardamos três coisas — e só três:
//   1. em que pendência ele parou;
//   2. onde a leitura estava (rolagem) dentro dessa pendência;
//   3. em que seção do portal ele estava (a navegação interna não mexe na URL,
//      então sem isto todo F5 devolve o cliente ao "Resumo").
//
// O CONTEÚDO já é persistido em banco por quem o produz (Efetiva Necessidade
// autossalva relato, respostas e provas; documentos vivem no Hub). Aqui só
// guardamos a POSIÇÃO — e sempre revalidada contra a fila real, para que uma
// pendência resolvida em outro dispositivo nunca seja "retomada".
// ============================================================================

const PREFIX_CHECKLIST = "qa_checklist_retomada";

/** Depois disso a posição é lixo: o processo mudou, o cliente também. */
const RETOMADA_VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

export interface ChecklistRetomada {
  /** Id do item da fila (`doc:123`, `efetiva:<processo>:<passo>`, `sig:...`). */
  pendenciaId: string | null;
  /** Rolagem do corpo do checklist, em px, referente a `pendenciaId`. */
  scrollTop: number;
  /** Seção do portal (`checklist_guiado`, `documentos`, `financeiro`, …). */
  secao: string | null;
  updatedAt: string;
}

const RETOMADA_VAZIA: ChecklistRetomada = {
  pendenciaId: null,
  scrollTop: 0,
  secao: null,
  updatedAt: "",
};

export function getChecklistRetomadaKey(clienteId: number | string | null | undefined): string | null {
  const cli = clienteId == null ? "" : String(clienteId).trim();
  if (!cli) return null;
  return `${PREFIX_CHECKLIST}:${cli}`;
}

/** Registro salvo, ou `null` quando não existe / está vencido / corrompido. */
export function loadChecklistRetomada(
  clienteId: number | string | null | undefined,
): ChecklistRetomada | null {
  const key = getChecklistRetomadaKey(clienteId);
  const st = safeStorage();
  if (!key || !st) return null;
  try {
    const raw = st.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChecklistRetomada>;
    if (!parsed || typeof parsed !== "object") return null;
    const idade = Date.now() - Date.parse(String(parsed.updatedAt ?? ""));
    if (!Number.isFinite(idade) || idade > RETOMADA_VALIDADE_MS) {
      st.removeItem(key);
      return null;
    }
    return {
      pendenciaId: parsed.pendenciaId ?? null,
      scrollTop: Number.isFinite(parsed.scrollTop) ? Number(parsed.scrollTop) : 0,
      secao: parsed.secao ?? null,
      updatedAt: String(parsed.updatedAt),
    };
  } catch {
    return null;
  }
}

/**
 * Grava por MESCLA — o popup escreve `pendenciaId`/`scrollTop` e o portal
 * escreve `secao`, cada um no seu tempo, sem apagar o campo do outro.
 */
export function saveChecklistRetomada(
  clienteId: number | string | null | undefined,
  patch: Partial<Omit<ChecklistRetomada, "updatedAt">>,
): void {
  const key = getChecklistRetomadaKey(clienteId);
  const st = safeStorage();
  if (!key || !st) return;
  try {
    const atual = loadChecklistRetomada(clienteId) ?? RETOMADA_VAZIA;
    const next: ChecklistRetomada = {
      ...atual,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    st.setItem(key, JSON.stringify(next));
  } catch {
    /* silencioso — persistência é best-effort */
  }
}

export function clearChecklistRetomada(clienteId: number | string | null | undefined): void {
  const key = getChecklistRetomadaKey(clienteId);
  const st = safeStorage();
  if (!key || !st) return;
  try {
    st.removeItem(key);
  } catch {
    /* noop */
  }
}

/**
 * Índice de retomada dentro da fila JÁ recalculada.
 *
 * Devolve `-1` quando não há posição salva ou quando o item salvo não está
 * mais pendente — nesse caso quem chama mantém a ordem natural da fila, que é
 * a regra de negócio ("uma exigência por vez", sempre a primeira).
 */
export function resolveRetomadaIndex<T extends { id: string }>(
  fila: T[],
  salvo: ChecklistRetomada | null,
): number {
  if (!fila.length || !salvo?.pendenciaId) return -1;
  return fila.findIndex((p) => p.id === salvo.pendenciaId);
}
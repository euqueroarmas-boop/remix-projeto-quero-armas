import { lazy, type ComponentType } from "react";
import { logSistema } from "@/lib/logSistema";

const RELOAD_KEY = "qa_chunk_reload";
const RELOAD_COUNT_KEY = "qa_chunk_reload_count";
const RELOAD_MAX_MS = 5 * 60_000;
const RELOAD_MAX_ATTEMPTS = 3;

function isChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("undefined is not an object") ||
    msg.includes("_result.default") ||
    msg.includes("cannot read properties of undefined") ||
    msg.includes("reading 'default'") ||
    msg.includes("lazyinvalidmodule")
  );
}

function getStoredChunkReloadState() {
  const rawTs = localStorage.getItem(RELOAD_KEY) || sessionStorage.getItem(RELOAD_KEY);
  const ts = rawTs ? parseInt(rawTs, 10) : 0;
  const fresh = !!ts && Date.now() - ts < RELOAD_MAX_MS;
  const count = fresh ? parseInt(localStorage.getItem(RELOAD_COUNT_KEY) || sessionStorage.getItem(RELOAD_COUNT_KEY) || "0", 10) || 0 : 0;
  return { count, fresh };
}

export function attemptChunkReload(reason: string, moduleName?: string, error?: unknown): boolean {
  const { count } = getStoredChunkReloadState();
  if (count >= RELOAD_MAX_ATTEMPTS) return false;

  const nextCount = count + 1;
  const now = Date.now().toString();
  sessionStorage.setItem(RELOAD_KEY, now);
  localStorage.setItem(RELOAD_KEY, now);
  sessionStorage.setItem(RELOAD_COUNT_KEY, String(nextCount));
  localStorage.setItem(RELOAD_COUNT_KEY, String(nextCount));

  logSistema({
    tipo: "erro",
    status: "error",
    mensagem: `[ChunkReload] tentativa ${nextCount}/${RELOAD_MAX_ATTEMPTS}: ${reason}`,
    payload: {
      module: moduleName,
      url: window.location.href,
      error_message: error instanceof Error ? error.message : error ? String(error) : null,
      attempt: nextCount,
      user_agent: navigator.userAgent,
    },
  });

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_cb", Date.now().toString());
    url.searchParams.set("_chunk_retry", String(nextCount));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }

  return true;
}

/**
 * Wraps a dynamic import with retry logic for stale chunk recovery.
 * On chunk load failure:
 *  1. Retries the import up to `retries` times
 *  2. If all retries fail, performs a single hard reload (tracked via sessionStorage)
 *  3. If already reloaded once, lets the error propagate to ErrorBoundary
 */
export function lazyRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  moduleName?: string,
  retries = 2
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Add cache-busting on retry attempts
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
        const mod = await importFn();
        if (!mod || typeof (mod as any).default !== "function") {
          throw new Error(`[LazyInvalidModule] ${moduleName || "unknown"} não retornou default export válido`);
        }
        sessionStorage.removeItem(RELOAD_KEY);
        return mod;
      } catch (err) {
        if (!isChunkError(err) || attempt === retries) {
          // Not a chunk error or exhausted retries — try auto reload once
          if (isChunkError(err)) {
            const { count } = getStoredChunkReloadState();

            logSistema({
              tipo: "erro",
              status: "error",
              mensagem: `[ChunkLoad] ${moduleName || "unknown"} falhou após ${retries + 1} tentativas`,
              payload: {
                module: moduleName,
                url: window.location.href,
                error_message: err instanceof Error ? err.message : String(err),
                reload_count: count,
                user_agent: navigator.userAgent,
                attempt: attempt + 1,
              },
            });

            if (attemptChunkReload("lazy-import-failed", moduleName, err)) {
              // Return a never-resolving promise to prevent rendering while reloading
              return new Promise(() => {});
            }
            // Limite de recargas atingido: deixa o erro subir para o
            // ErrorBoundary mostrar UI clara em vez de cair em loop infinito.
          }
          throw err;
        }
        // Chunk error with retries remaining — continue loop
        console.warn(`[lazyRetry] Attempt ${attempt + 1} failed for ${moduleName || "module"}, retrying...`);
      }
    }
    // Should never reach here, but satisfy TS
    return importFn();
  });
}

/** Call on app mount to clear the reload flag if we successfully loaded */
export function clearChunkReloadFlag() {
  // Só limpa depois de 60s saudáveis — confirma que o app montou de verdade
  // sem precisar de outro reload, evitando que um novo chunk-error reabra o
  // ciclo de reload infinito (login → /dashboard → fail → reload → fail → ...).
  window.setTimeout(() => {
    sessionStorage.removeItem(RELOAD_KEY);
    localStorage.removeItem(RELOAD_KEY);
    sessionStorage.removeItem(RELOAD_COUNT_KEY);
    localStorage.removeItem(RELOAD_COUNT_KEY);
  }, 60_000);
}

export { isChunkError };

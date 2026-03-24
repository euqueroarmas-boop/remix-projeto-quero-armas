import { lazy, type ComponentType } from "react";
import { logSistema } from "@/lib/logSistema";

const RELOAD_KEY = "wmti_chunk_reload";

function isChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("dynamically imported module")
  );
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
        return await importFn();
      } catch (err) {
        if (!isChunkError(err) || attempt === retries) {
          // Not a chunk error or exhausted retries — try auto reload once
          if (isChunkError(err)) {
            const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
            
            logSistema({
              tipo: "erro",
              status: "error",
              mensagem: `[ChunkLoad] ${moduleName || "unknown"} falhou após ${retries + 1} tentativas`,
              payload: {
                module: moduleName,
                url: window.location.href,
                error_message: err instanceof Error ? err.message : String(err),
                already_reloaded: !!alreadyReloaded,
                user_agent: navigator.userAgent,
                attempt: attempt + 1,
              },
            });

            if (!alreadyReloaded) {
              sessionStorage.setItem(RELOAD_KEY, Date.now().toString());
              window.location.reload();
              // Return a never-resolving promise to prevent rendering while reloading
              return new Promise(() => {});
            }
            // Already reloaded once, clear flag and let error propagate
            sessionStorage.removeItem(RELOAD_KEY);
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
  sessionStorage.removeItem(RELOAD_KEY);
}

export { isChunkError };

import { useCallback, useEffect, useRef, useState } from "react";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface ResilientLoadResult<T> {
  /** Dado carregado (ou null antes do primeiro sucesso). */
  data: T | null;
  /** Status atual da carga. */
  status: LoadStatus;
  /** Erro normalizado quando status === "error". */
  error: Error | null;
  /** Re-executa o loader. Reseta erro/timeout. */
  reload: () => void;
  /** Atualiza o dado em memória sem refetch (útil após mutações otimistas). */
  setData: (updater: T | ((prev: T | null) => T)) => void;
  /** True na primeira carga (não dispara em reloads subsequentes). */
  initialLoading: boolean;
}

export interface ResilientLoadOptions {
  /** Timeout em ms. Após isso o loader é considerado falho. Default 12000. */
  timeoutMs?: number;
  /** Número de retries automáticos antes de expor erro. Default 0 (sem retry automático — usuário aciona). */
  retries?: number;
  /** Atraso antes de cada retry, em ms. Default 800. */
  retryDelayMs?: number;
  /** Quando false, não dispara o loader automaticamente. Default true. */
  enabled?: boolean;
  /** Rótulo usado em logs/diagnóstico. */
  label?: string;
}

/**
 * Hook padrão de carregamento resiliente para o módulo Quero Armas.
 *
 * Garantias:
 * - Loading sempre termina (timeout duro previne spinner eterno).
 * - Retry automático opcional, com backoff fixo curto.
 * - Erros nunca silenciosos: sempre expõe `error` quando falha.
 * - Reload manual disponível para botões "tentar novamente".
 * - Cancela trabalho pendente em desmontagem (sem warnings de setState).
 * - Use deps para re-executar quando inputs mudam.
 */
export function useResilientLoad<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options: ResilientLoadOptions = {},
): ResilientLoadResult<T> {
  const {
    timeoutMs = 12000,
    retries = 0,
    retryDelayMs = 800,
    enabled = true,
    label = "useResilientLoad",
  } = options;

  const [data, setDataState] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>(enabled ? "loading" : "idle");
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const initialLoadDoneRef = useRef(false);
  const mountedRef = useRef(true);

  // Mantém o loader em ref para que mudanças na referência não disparem reload sozinhas.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    setStatus("loading");
    setError(null);

    const run = async () => {
      while (true) {
        try {
          const racePromise = loaderRef.current(controller.signal);
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              controller.abort();
              reject(new Error(`${label}: timeout após ${timeoutMs}ms`));
            }, timeoutMs);
          });

          const result = await Promise.race([racePromise, timeoutPromise]);
          if (timeoutId) clearTimeout(timeoutId);
          if (cancelled || !mountedRef.current) return;

          setDataState(result);
          setStatus("ready");
          setError(null);
          initialLoadDoneRef.current = true;
          return;
        } catch (err) {
          if (timeoutId) clearTimeout(timeoutId);
          if (cancelled || !mountedRef.current) return;

          const isAbort = (err as { name?: string })?.name === "AbortError";
          if (isAbort && cancelled) return;

          if (attempt < retries) {
            attempt++;
            await new Promise((r) => setTimeout(r, retryDelayMs));
            if (cancelled || !mountedRef.current) return;
            continue;
          }

          const normalized =
            err instanceof Error ? err : new Error(String(err ?? "Erro desconhecido"));
          // eslint-disable-next-line no-console
          console.warn(`[${label}] falhou:`, normalized);
          setError(normalized);
          setStatus("error");
          initialLoadDoneRef.current = true;
          return;
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setDataState((prev) =>
      typeof updater === "function"
        ? (updater as (p: T | null) => T)(prev)
        : updater,
    );
  }, []);

  return {
    data,
    status,
    error,
    reload,
    setData,
    initialLoading: status === "loading" && !initialLoadDoneRef.current,
  };
}

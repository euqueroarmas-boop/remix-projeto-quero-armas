import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loader resiliente para widgets de dashboard.
 * - Timeout máximo configurável (default 6s) — nunca gira para sempre.
 * - Estados explícitos: loading | ready | error | timeout.
 * - Retry manual via `reload()`.
 * - Cancela atualizações em unmount (evita warning de state em componente desmontado).
 *
 * Uso:
 *   const { state, data, error, reload } = useWidgetLoader(async (signal) => { ... }, []);
 */
export type WidgetState = "loading" | "ready" | "error" | "timeout";

export interface WidgetLoaderResult<T> {
  state: WidgetState;
  data: T | null;
  error: Error | null;
  reload: () => void;
}

export function useWidgetLoader<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: any[] = [],
  options: { timeoutMs?: number } = {}
): WidgetLoaderResult<T> {
  const { timeoutMs = 6000 } = options;
  const [state, setState] = useState<WidgetState>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    setState("loading");
    setError(null);

    const safe = (fn: () => void) => {
      if (mountedRef.current) fn();
    };

    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      controller.abort();
      safe(() => setState("timeout"));
    }, timeoutMs);

    loader(controller.signal)
      .then((result) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        safe(() => {
          setData(result);
          setState("ready");
        });
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        // Se foi abortado pelo timeout, já marcamos como timeout
        if (controller.signal.aborted) return;
        safe(() => {
          setError(err instanceof Error ? err : new Error(String(err)));
          setState("error");
        });
      });

    return () => {
      mountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { state, data, error, reload };
}

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export interface SubmitActionOptions {
  /** Mensagem de toast enquanto a ação roda. Default: "Salvando…". */
  loadingMessage?: string;
  /** Mensagem de sucesso. Default: "Salvo." */
  successMessage?: string | ((result: unknown) => string);
  /** Mensagem de erro. Default: extrai do Error. */
  errorMessage?: string | ((err: unknown) => string);
  /** Quando false, não exibe toast de loading. Default true. */
  showLoadingToast?: boolean;
  /** Quando false, não exibe toast de sucesso. Default true. */
  showSuccessToast?: boolean;
  /** Tempo mínimo de "submitting" para evitar flicker, em ms. Default 0. */
  minDurationMs?: number;
}

/**
 * Wrapper para ações de submit (criar, salvar, excluir).
 *
 * Garante:
 * - submitting=true durante toda a ação (use no `disabled` do botão para evitar duplo-clique).
 * - Toast de loading → success/error consistente.
 * - Erros nunca silenciosos.
 * - Resolve com o resultado real quando OK; lança quando falha (sem swallow).
 */
export function useSubmitAction() {
  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const run = useCallback(
    async <T>(action: () => Promise<T>, options: SubmitActionOptions = {}): Promise<T> => {
      const {
        loadingMessage = "Salvando…",
        successMessage = "Salvo.",
        errorMessage,
        showLoadingToast = true,
        showSuccessToast = true,
        minDurationMs = 0,
      } = options;

      if (inFlightRef.current) {
        // Bloqueia duplo envio acidental.
        throw new Error("Já existe uma ação em andamento.");
      }

      inFlightRef.current = true;
      setSubmitting(true);
      const toastId = showLoadingToast ? toast.loading(loadingMessage) : undefined;
      const startedAt = Date.now();

      try {
        const result = await action();

        if (minDurationMs > 0) {
          const elapsed = Date.now() - startedAt;
          if (elapsed < minDurationMs) {
            await new Promise((r) => setTimeout(r, minDurationMs - elapsed));
          }
        }

        if (toastId !== undefined) toast.dismiss(toastId);
        if (showSuccessToast) {
          const msg =
            typeof successMessage === "function" ? successMessage(result) : successMessage;
          toast.success(msg);
        }
        return result;
      } catch (err) {
        if (toastId !== undefined) toast.dismiss(toastId);
        const fallback =
          err instanceof Error ? err.message : "Não foi possível concluir a ação.";
        const msg =
          typeof errorMessage === "function"
            ? errorMessage(err)
            : errorMessage ?? fallback;
        toast.error(msg);
        throw err;
      } finally {
        inFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [],
  );

  return { submitting, run };
}

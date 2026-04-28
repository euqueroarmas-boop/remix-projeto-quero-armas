import { supabase } from "@/integrations/supabase/client";

/**
 * URL canônica para o link de redefinição de senha.
 * Em produção, força o domínio oficial para evitar variações com www/preview/lovable.app
 * que poderiam não estar nas Redirect URLs do Supabase.
 */
export const QA_PASSWORD_RESET_REDIRECT_URL: string = (() => {
  if (typeof window === "undefined") {
    return "https://euqueroarmas.com.br/redefinir-senha";
  }
  const host = window.location.hostname;
  const isProdDomain =
    host === "euqueroarmas.com.br" || host === "www.euqueroarmas.com.br";
  if (isProdDomain) {
    return "https://euqueroarmas.com.br/redefinir-senha";
  }
  // Preview/lovable/localhost: usa origin atual (a edge function valida o host na allowlist)
  return `${window.location.origin}/redefinir-senha`;
})();

export interface PasswordResetResult {
  success: boolean;
  errorMessage?: string;
  traceId?: string;
}

/**
 * Dispara o e-mail de redefinição de senha usando o SMTP próprio WMTi
 * (edge function `request-password-reset`), com fallback para o fluxo
 * nativo do Supabase em caso de indisponibilidade da função.
 *
 * Sempre logamos o resultado em desenvolvimento para diagnóstico.
 */
export async function requestQAPasswordReset(
  rawEmail: string
): Promise<PasswordResetResult> {
  const email = rawEmail.trim().toLowerCase();
  const redirectTo = QA_PASSWORD_RESET_REDIRECT_URL;

  // Log de diagnóstico (visível em dev)
  // eslint-disable-next-line no-console
  console.info("[QA Password Reset] start", { email, redirectTo });

  try {
    const { data, error } = await supabase.functions.invoke(
      "request-password-reset",
      {
        body: { email, redirectTo, brand: "quero-armas" },
      }
    );

    // eslint-disable-next-line no-console
    console.info("[QA Password Reset] edge response", { data, error });

    if (error) {
      // Fallback para o fluxo nativo se a edge function falhar
      return await fallbackNativeReset(email, redirectTo, error.message);
    }

    if (data && (data as any).error) {
      return await fallbackNativeReset(
        email,
        redirectTo,
        String((data as any).error)
      );
    }

    return {
      success: true,
      traceId: (data as any)?.traceId,
    };
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[QA Password Reset] edge exception", err);
    return await fallbackNativeReset(email, redirectTo, err?.message);
  }
}

async function fallbackNativeReset(
  email: string,
  redirectTo: string,
  upstreamMessage?: string
): Promise<PasswordResetResult> {
  // eslint-disable-next-line no-console
  console.warn("[QA Password Reset] fallback to supabase.auth.resetPasswordForEmail", {
    upstreamMessage,
  });
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  // eslint-disable-next-line no-console
  console.info("[QA Password Reset] native response", { data, error });
  if (error) {
    return { success: false, errorMessage: error.message };
  }
  return { success: true };
}
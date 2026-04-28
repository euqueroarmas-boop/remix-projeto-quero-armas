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
 * Dispara o e-mail de redefinição de senha do Quero Armas usando o SMTP
 * próprio (edge function `request-password-reset`, brand "quero-armas").
 *
 * NÃO usa o SMTP padrão do Supabase (resetPasswordForEmail) — em produção
 * isso enviaria com template/remetente errado. Em caso de falha da edge
 * function, retornamos erro explícito.
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
      return {
        success: false,
        errorMessage:
          "Não foi possível enviar o e-mail de recuperação agora. Tente novamente em instantes.",
      };
    }

    if (data && (data as any).error) {
      return {
        success: false,
        errorMessage:
          "Não foi possível enviar o e-mail de recuperação agora. Tente novamente em instantes.",
      };
    }

    return {
      success: true,
      traceId: (data as any)?.traceId,
    };
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[QA Password Reset] edge exception", err);
    return {
      success: false,
      errorMessage:
        "Não foi possível enviar o e-mail de recuperação agora. Tente novamente em instantes.",
    };
  }
}
import { supabase } from "@/integrations/supabase/client";

/**
 * URL canônica FIXA para o link de redefinição de senha do Quero Armas.
 * NUNCA derivar de window.location.origin — em produção o e-mail real
 * precisa sair sempre com este host, mesmo se a solicitação vier de
 * preview/lovable.app/localhost. A edge function também força isso para
 * brand=quero-armas em APP_ENV=production.
 */
export const QA_PASSWORD_RESET_REDIRECT_URL =
  "https://euqueroarmas.com.br/redefinir-senha";

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

  // eslint-disable-next-line no-console
  console.info("[QA Password Reset] start", {
    email,
    redirectTo: QA_PASSWORD_RESET_REDIRECT_URL,
  });

  try {
    const { data, error } = await supabase.functions.invoke(
      "request-password-reset",
      {
        body: {
          email,
          redirectTo: QA_PASSWORD_RESET_REDIRECT_URL,
          brand: "quero-armas",
        },
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
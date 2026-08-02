import { lovable } from "@/integrations/lovable/index";
import { sanitizeClientPortalNext } from "@/shared/quero-armas/portalNavigation";

export const OAUTH_NEXT_KEY = "qa_oauth_next";

/**
 * Login social (Google / Apple) via Lovable Cloud.
 *
 * Regras que evitam o erro "State verification failed / invalid_request":
 *  • redirect_uri SEMPRE a origem canônica (window.location.origin). Caminhos
 *    internos podem não estar na allow-list do broker e derrubam o state.
 *  • o destino pós-login vai em localStorage + sessionStorage (in-app browsers
 *    do iOS podem não compartilhar sessionStorage entre abas).
 */
export async function signInWithSocial(
  provider: "google" | "apple",
  nextPath: string,
): Promise<{ error?: Error; redirected?: boolean }> {
  const safeNext = sanitizeClientPortalNext(nextPath);
  try { localStorage.setItem(OAUTH_NEXT_KEY, safeNext); } catch { /* storage indisponível */ }
  try { sessionStorage.setItem(OAUTH_NEXT_KEY, safeNext); } catch { /* storage indisponível */ }

  const result = await lovable.auth.signInWithOAuth(provider, {
    redirect_uri: window.location.origin,
    extraParams: provider === "google" ? { prompt: "select_account" } : undefined,
  });

  return result as { error?: Error; redirected?: boolean };
}

export function readOAuthNext(): string {
  let stored: string | null = null;
  try { stored = sessionStorage.getItem(OAUTH_NEXT_KEY); } catch { /* ignore */ }
  if (!stored) {
    try { stored = localStorage.getItem(OAUTH_NEXT_KEY); } catch { /* ignore */ }
  }
  return sanitizeClientPortalNext(stored);
}

export function clearOAuthNext() {
  try { localStorage.removeItem(OAUTH_NEXT_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(OAUTH_NEXT_KEY); } catch { /* ignore */ }
}

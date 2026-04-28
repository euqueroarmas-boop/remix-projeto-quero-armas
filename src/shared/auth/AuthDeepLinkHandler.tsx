import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Detecta parâmetros de recuperação de senha em qualquer rota (especialmente "/")
 * e redireciona para /redefinir-senha preservando code/hash/token.
 *
 * Causa-raiz: o e-mail de recovery do Supabase pode chegar com:
 *   - ?code=xxx                              (PKCE)
 *   - #access_token=...&type=recovery        (legacy hash)
 *   - ?token_hash=xxx&type=recovery          (OTP)
 *
 * Sem este handler, links que aterrissam em "/" caem na HomePage e os parâmetros
 * são engolidos pelo router antes do modal/página de redefinição abrir.
 */
export function AuthDeepLinkHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Já estamos na página de redefinição: deixa ela tratar.
    if (location.pathname.startsWith("/redefinir-senha")) return;

    const search = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));

    const type = (search.get("type") || hash.get("type") || "").toLowerCase();
    const code = search.get("code");
    const tokenHash = search.get("token_hash") || hash.get("token_hash");
    const error = search.get("error") || hash.get("error");
    const errorDescription = search.get("error_description") || hash.get("error_description");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const mode = (search.get("mode") || "").toLowerCase();
    const reset = search.get("reset");
    const hasRecoveryError = Boolean(error || errorDescription) && (type === "recovery" || mode === "recovery" || reset === "true");

    const isRecovery =
      type === "recovery" ||
      mode === "recovery" ||
      reset === "true" ||
      hasRecoveryError ||
      // Heurística: `code` PKCE em raiz ou home → tratar como callback de auth.
      (!!code && ["/", "", "/auth/callback", "/login", "/area-do-cliente/login"].includes(location.pathname)) ||
      (!!accessToken && !!refreshToken && ["/", "", "/auth/callback", "/login", "/area-do-cliente/login"].includes(location.pathname));

    if (!isRecovery) return;

    const target = new URL("/redefinir-senha", window.location.origin);
    if (code) target.searchParams.set("code", code);
    if (tokenHash) target.searchParams.set("token_hash", tokenHash);
    if (type && !accessToken) target.searchParams.set("type", type || "recovery");
    if (mode) target.searchParams.set("mode", mode);
    if (reset) target.searchParams.set("reset", reset);
    if (error) target.searchParams.set("error", error);
    if (errorDescription) target.searchParams.set("error_description", errorDescription);
    let finalUrl = target.pathname + target.search;
    if (accessToken && refreshToken) {
      finalUrl += `#access_token=${accessToken}&refresh_token=${refreshToken}&type=recovery`;
    }

    navigate(finalUrl, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}

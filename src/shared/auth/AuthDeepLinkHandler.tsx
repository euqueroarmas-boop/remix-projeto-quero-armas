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
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const mode = (search.get("mode") || "").toLowerCase();
    const reset = search.get("reset");

    const isRecovery =
      type === "recovery" ||
      mode === "recovery" ||
      reset === "true" ||
      // Heurística: `code` PKCE em raiz ou home → tratar como callback de auth.
      (!!code && (location.pathname === "/" || location.pathname === "")) ||
      (!!accessToken && !!refreshToken && (location.pathname === "/" || location.pathname === ""));

    if (!isRecovery) return;

    const target = new URL("/redefinir-senha", window.location.origin);
    if (code) target.searchParams.set("code", code);
    if (tokenHash) target.searchParams.set("token_hash", tokenHash);
    if (type) target.searchParams.set("type", type || "recovery");
    let finalUrl = target.pathname + target.search;
    if (accessToken && refreshToken) {
      finalUrl += `#access_token=${accessToken}&refresh_token=${refreshToken}&type=recovery`;
    }

    navigate(finalUrl, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}

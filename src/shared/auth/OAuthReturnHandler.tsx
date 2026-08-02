import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { readOAuthNext } from "@/shared/auth/socialSignIn";

/**
 * O broker OAuth devolve o usuário na origem canônica ("/") com os tokens no
 * hash (ou ?code=). Sem este handler a HomePage engole os parâmetros e o
 * usuário nunca chega ao destino pretendido.
 */
export function OAuthReturnHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname.startsWith("/auth/callback")) return;
    if (location.pathname.startsWith("/redefinir-senha")) return;

    const search = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const type = (search.get("type") || hash.get("type") || "").toLowerCase();
    if (type === "recovery") return; // AuthDeepLinkHandler cuida disso

    const code = search.get("code");
    const accessToken = hash.get("access_token");
    const errorDesc = search.get("error_description") || hash.get("error_description");
    const error = search.get("error") || hash.get("error");

    const hasOAuthPayload = Boolean(code || accessToken || error || errorDesc);
    if (!hasOAuthPayload) return;

    const next = readOAuthNext();
    const target = new URL("/auth/callback", window.location.origin);
    target.searchParams.set("next", next);
    if (code) target.searchParams.set("code", code);
    if (error) target.searchParams.set("error", error);
    if (errorDesc) target.searchParams.set("error_description", errorDesc);

    const finalUrl = target.pathname + target.search + (location.hash || "");
    navigate(finalUrl, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}

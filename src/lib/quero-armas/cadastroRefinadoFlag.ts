/**
 * Feature flag — /cadastro refinado (Jeito 3).
 * Lida em runtime no roteador. Quando true, renderiza QACadastroRefinadoPage.
 * Quando false/ausente, mantém QACadastroPublicoPage (fluxo legado intacto).
 */
export function isCadastroRefinadoEnabled(): boolean {
  // Suporta override por querystring para QA: ?cadastro_v2=1 / ?cadastro_v2=0
  if (typeof window !== "undefined") {
    try {
      const sp = new URLSearchParams(window.location.search);
      const q = sp.get("cadastro_v2");
      if (q === "1" || q === "true") return true;
      if (q === "0" || q === "false") return false;
    } catch {
      /* ignore */
    }
  }
  return import.meta.env.VITE_QA_CADASTRO_V2_ENABLED === "true";
}
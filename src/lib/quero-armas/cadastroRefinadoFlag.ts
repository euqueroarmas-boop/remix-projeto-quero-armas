/**
 * Resolução do roteador para /cadastro.
 *
 * REGRAS (após promoção do refinado a padrão):
 * 1. /cadastro abre QACadastroRefinadoPage por DEFAULT.
 * 2. QACadastroPublicoPage (legado) permanece intacto no projeto como
 *    rollback / canal de fallback. Só é renderizado se:
 *      - querystring `?cadastro_legado=1` (canal de emergência), OU
 *      - VITE_QA_CADASTRO_V2_ENABLED === "false" (kill-switch reverso),
 *    OU `?cadastro_v2=0` em runtime.
 * 3. `?cadastro_v2=1` continua forçando o refinado (idempotente com o default).
 */
export function isCadastroRefinadoEnabled(): boolean {
  if (typeof window !== "undefined") {
    try {
      const sp = new URLSearchParams(window.location.search);
      // Canal de emergência (não documentado para clientes)
      if (sp.get("cadastro_legado") === "1" || sp.get("cadastro_legado") === "true") {
        return false;
      }
      const q = sp.get("cadastro_v2");
      if (q === "1" || q === "true") return true;
      if (q === "0" || q === "false") return false;
    } catch {
      /* ignore */
    }
  }
  // Kill-switch reverso: só desliga se EXPLICITAMENTE "false"
  if (import.meta.env.VITE_QA_CADASTRO_V2_ENABLED === "false") return false;
  // Default: refinado ligado
  return true;
}
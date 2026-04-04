import { useMemo } from "react";

export type ServiceStatusLevel = "restricted" | "full";

const FULL_ACCESS_STATUSES = new Set(["paid", "active"]);
const RESTRICTED_TABS = new Set(["servicos", "solicitacoes"]);
const ALWAYS_ALLOWED_TABS = new Set(["overview", "financeiro", "documentos", "perfil", "fiscal"]);

/**
 * Derives the portal access level from the best contract service_status.
 * If ANY contract is paid/active → full access.
 * Otherwise → restricted (can only see overview, financeiro, documentos, perfil, fiscal).
 */
export function useServiceStatus(contracts: any[]): {
  accessLevel: ServiceStatusLevel;
  bestStatus: string;
  isTabAllowed: (tabId: string) => boolean;
  restrictedMessage: string;
} {
  const bestStatus = useMemo(() => {
    if (!contracts.length) return "contract_generated";
    // Priority order: active > paid > payment_under_review > payment_pending > overdue > suspended > contract_generated
    const priority = ["active", "paid", "payment_under_review", "payment_pending", "overdue", "suspended", "contract_generated"];
    for (const s of priority) {
      if (contracts.some((c: any) => c.service_status === s)) return s;
    }
    return contracts[0]?.service_status || "contract_generated";
  }, [contracts]);

  const accessLevel: ServiceStatusLevel = FULL_ACCESS_STATUSES.has(bestStatus) ? "full" : "restricted";

  const isTabAllowed = (tabId: string) => {
    if (accessLevel === "full") return true;
    return ALWAYS_ALLOWED_TABS.has(tabId);
  };

  const messages: Record<string, string> = {
    contract_generated: "Seu contrato foi gerado. Aguardando início do pagamento.",
    payment_pending: "Pagamento em processamento. O acesso completo será liberado após confirmação.",
    payment_under_review: "Seu pagamento está em análise. Entraremos em contato em breve.",
    overdue: "Pagamento vencido. Regularize para manter o acesso completo.",
    suspended: "Serviço suspenso. Entre em contato com o financeiro.",
  };

  return {
    accessLevel,
    bestStatus,
    isTabAllowed,
    restrictedMessage: messages[bestStatus] || "",
  };
}

import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CustomerData } from "@/pages/AreaDoClientePage";
import { useClientContracts } from "../hooks/useClientData";
import SectionHeader from "../shared/SectionHeader";
import StatusBadge from "../shared/StatusBadge";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import EmptyState from "../shared/EmptyState";
import { useTranslation } from "react-i18next";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(v: number | null) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PortalServicos({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation();
  const { contracts, loading } = useClientContracts(customer.id);

  return (
    <div className="space-y-6">
      <SectionHeader icon={Package} title={t("clientPortal.tabs.servicos")} description={t("clientPortal.services.description")} />

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : contracts.length === 0 ? (
        <EmptyState icon={Package} title={t("clientPortal.services.emptyTitle")} description={t("clientPortal.services.emptyDescription")} />
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <Card key={c.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-heading font-bold text-foreground">
                        {c.contract_type === "locacao" ? t("clientPortal.services.types.locacao") :
                         c.contract_type === "suporte" ? t("clientPortal.services.types.suporte") :
                         c.contract_type === "horas" ? t("clientPortal.services.types.horas") :
                         c.contract_type === "reestruturacao" ? t("clientPortal.services.types.reestruturacao") :
                         c.contract_type || t("clientPortal.services.types.default")}
                      </h3>
                      <StatusBadge status={c.signed ? "active" : c.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                       <span>{t("clientPortal.services.hiredAt", { date: formatDate(c.created_at) })}</span>
                       {c.monthly_value && <span>{t("clientPortal.services.value", { value: formatCurrency(c.monthly_value) })}</span>}
                    </div>
                  </div>
                </div>

                {c.quotes && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {c.quotes.computers_qty && (
                       <div><span className="text-muted-foreground">{t("clientPortal.services.computers")}</span> <span className="text-foreground font-medium">{c.quotes.computers_qty}</span></div>
                    )}
                    {c.quotes.users_qty && (
                       <div><span className="text-muted-foreground">{t("clientPortal.services.users")}</span> <span className="text-foreground font-medium">{c.quotes.users_qty}</span></div>
                    )}
                    {c.quotes.selected_plan && (
                       <div><span className="text-muted-foreground">{t("clientPortal.services.plan")}</span> <span className="text-foreground font-medium capitalize">{c.quotes.selected_plan}</span></div>
                    )}
                    {c.quotes.needs_backup && (
                       <div><span className="text-muted-foreground">{t("clientPortal.services.backup")}</span> <span className="text-emerald-400 font-medium">{t("clientPortal.yes")}</span></div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

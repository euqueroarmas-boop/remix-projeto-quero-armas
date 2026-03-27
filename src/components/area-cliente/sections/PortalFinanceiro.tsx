import { useState } from "react";
import { DollarSign, ExternalLink, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CustomerData } from "@/pages/AreaDoClientePage";
import { useClientPayments } from "../hooks/useClientData";
import SectionHeader from "../shared/SectionHeader";
import StatusBadge from "../shared/StatusBadge";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import EmptyState from "../shared/EmptyState";
import { useTranslation } from "react-i18next";

const filters = ["todos", "pending", "confirmed", "overdue", "cancelled"] as const;
const filterLabels: Record<string, string> = {
  todos: "Todos", pending: "Pendente", confirmed: "Pago", overdue: "Vencido", cancelled: "Cancelado",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function paymentMethodLabel(m: string | null) {
  if (!m) return "—";
  const map: Record<string, string> = { CREDIT_CARD: "Cartão de Crédito", BOLETO: "Boleto", PIX: "PIX" };
  return map[m] || m;
}

export default function PortalFinanceiro({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation();
  const { payments, loading } = useClientPayments(customer.id);
  const [filter, setFilter] = useState<string>("todos");

  const filtered = filter === "todos"
    ? payments
    : payments.filter((p) => (p.payment_status || "").toLowerCase() === filter.toLowerCase());

  return (
    <div className="space-y-6">
      <SectionHeader icon={DollarSign} title={t("clientPortal.tabs.financeiro")} description={t("clientPortal.finance.description")} />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className="text-xs"
            onClick={() => setFilter(f)}
          >
            {t(`clientPortal.finance.filters.${f}`)}
          </Button>
        ))}
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={DollarSign} title={t("clientPortal.finance.emptyTitle")} description={t("clientPortal.finance.emptyDescription")} />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-heading font-bold text-foreground">
                         {p.billing_type || t("clientPortal.finance.charge")}
                      </h4>
                      <StatusBadge status={p.payment_status} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                      <span>{paymentMethodLabel(p.payment_method)}</span>
                       {p.due_date && <span>{t("clientPortal.finance.dueDate", { date: formatDate(p.due_date) })}</span>}
                       <span>{t("clientPortal.finance.createdAt", { date: formatDate(p.created_at) })}</span>
                    </div>
                  </div>
                  {p.asaas_invoice_url && (
                    <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="text-xs">
                         <ExternalLink size={12} className="mr-1" /> {t("clientPortal.finance.viewCharge")}
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

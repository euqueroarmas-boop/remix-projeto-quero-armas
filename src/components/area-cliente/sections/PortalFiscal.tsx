import { FileText, Download, FileCode } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CustomerData } from "@/pages/AreaDoClientePage";
import { useClientFiscalDocs } from "../hooks/useClientData";
import SectionHeader from "../shared/SectionHeader";
import StatusBadge from "../shared/StatusBadge";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import EmptyState from "../shared/EmptyState";
import { useTranslation } from "react-i18next";

const docTypeLabels: Record<string, string> = {
  nota_fiscal: "Nota Fiscal",
  recibo: "Recibo",
  fatura: "Fatura",
  comprovante: "Comprovante",
  tributario: "Documento Tributário",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatCurrency(v: number | null) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PortalFiscal({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation();
  const { docs, loading } = useClientFiscalDocs(customer.id);

  return (
    <div className="space-y-6">
      <SectionHeader icon={FileText} title={t("clientPortal.tabs.fiscal")} description={t("clientPortal.fiscal.description")} />

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : docs.length === 0 ? (
        <EmptyState icon={FileText} title={t("clientPortal.fiscal.emptyTitle")} description={t("clientPortal.fiscal.emptyDescription")} />
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-heading font-bold text-foreground">
                        {docTypeLabels[d.document_type] || d.document_type}
                      </h4>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                       {d.document_number && <span>{t("clientPortal.fiscal.number", { value: d.document_number })}</span>}
                       <span>{t("clientPortal.fiscal.issueDate", { date: formatDate(d.issue_date) })}</span>
                       <span>{t("clientPortal.fiscal.amount", { value: formatCurrency(d.amount) })}</span>
                       {d.service_reference && <span>Serviço: {d.service_reference}</span>}
                    </div>
                    {d.notes && <p className="text-xs text-muted-foreground mt-1">{d.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    {d.file_url && (
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="text-xs">
                          <Download size={12} className="mr-1" /> PDF
                        </Button>
                      </a>
                    )}
                    {d.xml_url && (
                      <a href={d.xml_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="text-xs">
                          <FileCode size={12} className="mr-1" /> XML
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

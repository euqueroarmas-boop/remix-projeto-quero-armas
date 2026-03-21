import { useState } from "react";
import { FolderOpen, FileText, Download, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CustomerData } from "@/pages/AreaDoClientePage";
import { useClientContracts, useClientFiscalDocs } from "../hooks/useClientData";
import SectionHeader from "../shared/SectionHeader";
import StatusBadge from "../shared/StatusBadge";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import EmptyState from "../shared/EmptyState";

const categories = ["todos", "contratos", "fiscais"] as const;

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function PortalDocumentos({ customer }: { customer: CustomerData }) {
  const { contracts, loading: cl } = useClientContracts(customer.id);
  const { docs: fiscalDocs, loading: fl } = useClientFiscalDocs(customer.id);
  const [cat, setCat] = useState<string>("todos");

  const loading = cl || fl;

  const contractDocs = contracts.map((c) => ({
    id: c.id,
    type: "contrato" as const,
    title: c.contract_type === "locacao" ? "Contrato de Locação" :
           c.contract_type === "suporte" ? "Contrato de Suporte" :
           c.contract_type === "horas" ? "Contrato de Horas" :
           "Contrato",
    status: c.signed ? "Assinado" : c.status || "draft",
    date: c.signed_at || c.created_at,
    url: c.contract_pdf_path,
  }));

  const fiscalItems = fiscalDocs.map((d) => ({
    id: d.id,
    type: "fiscal" as const,
    title: d.document_type === "nota_fiscal" ? "Nota Fiscal" : d.document_type === "recibo" ? "Recibo" : d.document_type,
    status: d.status,
    date: d.issue_date || d.created_at,
    url: d.file_url,
  }));

  let allDocs = [...contractDocs, ...fiscalItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (cat === "contratos") allDocs = allDocs.filter((d) => d.type === "contrato");
  if (cat === "fiscais") allDocs = allDocs.filter((d) => d.type === "fiscal");

  return (
    <div className="space-y-6">
      <SectionHeader icon={FolderOpen} title="Contratos e Documentos" description="Todos os documentos centralizados" />

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} className="text-xs capitalize" onClick={() => setCat(c)}>
            {c === "todos" ? "Todos" : c === "contratos" ? "Contratos" : "Fiscais"}
          </Button>
        ))}
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : allDocs.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Nenhum documento" description="Contratos, notas fiscais e outros documentos aparecerão aqui." />
      ) : (
        <div className="space-y-2">
          {allDocs.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-heading font-bold text-foreground truncate">{d.title}</h4>
                    <p className="text-[10px] text-muted-foreground">{formatDate(d.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={d.status} />
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" className="h-7 w-7">
                        <Download size={14} />
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

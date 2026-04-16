import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  FileText, PenTool, Eye, FolderOpen, Clock, Shield, Lock,
  Download, Loader2, ChevronRight, Sparkles,
} from "lucide-react";
import type { CustomerData } from "@/pages/AreaDoClientePage";
import SectionHeader from "../shared/SectionHeader";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import CaseDetailPanel from "@/components/quero-armas/CaseDetailPanel";
import { downloadGeracaoDocx } from "@/lib/qaDocxDownload";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  customer: CustomerData;
  eligible: boolean;
}

const statusBadge = (s: string) => {
  if (s === "gerado" || s === "revisado") return { bg: "bg-emerald-500/10", text: "text-emerald-600", label: s === "gerado" ? "Gerado" : "Revisado" };
  if (s === "deferido") return { bg: "bg-green-500/10", text: "text-green-600", label: "Deferido" };
  if (s === "indeferido") return { bg: "bg-red-500/10", text: "text-red-500", label: "Indeferido" };
  if (s === "em_geracao") return { bg: "bg-blue-500/10", text: "text-blue-600", label: "Em geração" };
  if (s === "rascunho") return { bg: "bg-amber-500/10", text: "text-amber-600", label: "Rascunho" };
  return { bg: "bg-muted", text: "text-muted-foreground", label: s || "—" };
};

const statusColor = (s: string) => statusBadge(s).text;

export default function PortalPecas({ customer, eligible }: Props) {
  const { t } = useTranslation();

  // Blocked state for non-eligible clients
  if (!eligible) {
    return (
      <div className="space-y-6">
        <SectionHeader
          icon={FileText}
          title="Peças Jurídicas"
          description="Geração e acompanhamento de peças"
        />
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-muted/80 flex items-center justify-center mb-5">
              <Lock size={28} className="text-muted-foreground/60" />
            </div>
            <h3 className="font-heading text-lg font-bold text-foreground mb-2">
              Funcionalidade não disponível
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              A geração de peças fica disponível apenas para clientes com serviço de{" "}
              <span className="font-semibold text-foreground">posse</span> ou{" "}
              <span className="font-semibold text-foreground">porte de arma de fogo</span>.
            </p>
            <div className="flex items-center gap-2 mt-6 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/40">
              <Shield size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Entre em contato para contratar esse serviço
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <PortalPecasContent customer={customer} />;
}

function PortalPecasContent({ customer }: { customer: CustomerData }) {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailCase, setDetailCase] = useState<any>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      // Match cases by CPF/CNPJ
      const doc = customer.cnpj_ou_cpf?.replace(/\D/g, "") || "";
      if (!doc) { setCases([]); setLoading(false); return; }

      const { data } = await supabase
        .from("qa_casos" as any)
        .select("*")
        .eq("cpf_cnpj", doc)
        .order("created_at", { ascending: false })
        .limit(50);

      setCases((data as any[]) ?? []);
    } catch (err) {
      console.error("[PortalPecas] load error:", err);
    } finally {
      setLoading(false);
    }
  }, [customer.cnpj_ou_cpf]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const casosAtivos = cases.filter(c => c.status !== "deferido" && c.status !== "arquivado");
  const casosConcluidos = cases.filter(c => c.status === "deferido");

  const handleDownload = async (caso: any) => {
    if (!caso.geracao_id) {
      toast.error("Nenhuma peça gerada para este caso.");
      return;
    }
    setDownloadingId(caso.id);
    try {
      await downloadGeracaoDocx(caso.geracao_id);
      toast.success("Download iniciado!");
    } catch {
      toast.error("Erro ao baixar documento.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={FileText}
        title="Peças Jurídicas"
        description="Acompanhe o status das suas peças e documentos gerados"
      />

      {/* Stats */}
      {!loading && cases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: cases.length, icon: FolderOpen },
            { label: "Em Andamento", value: casosAtivos.length, icon: Clock },
            { label: "Deferidos", value: casosConcluidos.length, icon: Shield },
            { label: "Com Peça", value: cases.filter(c => c.geracao_id).length, icon: Sparkles },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <stat.icon size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cases list */}
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : cases.length === 0 ? (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FolderOpen size={24} className="text-muted-foreground" />
            </div>
            <h3 className="font-heading text-base font-bold text-foreground mb-1">
              Nenhuma peça encontrada
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Quando peças forem geradas para o seu processo, elas aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active cases */}
          {casosAtivos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
                <Clock size={14} className="text-primary" />
                Em Andamento ({casosAtivos.length})
              </h3>
              <div className="space-y-2">
                {casosAtivos.map((c) => (
                  <CaseCard
                    key={c.id}
                    caso={c}
                    onView={() => setDetailCase(c)}
                    onDownload={() => handleDownload(c)}
                    downloading={downloadingId === c.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed cases */}
          {casosConcluidos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
                <Shield size={14} className="text-emerald-500" />
                Deferidos ({casosConcluidos.length})
              </h3>
              <div className="space-y-2">
                {casosConcluidos.map((c) => (
                  <CaseCard
                    key={c.id}
                    caso={c}
                    onView={() => setDetailCase(c)}
                    onDownload={() => handleDownload(c)}
                    downloading={downloadingId === c.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail dialog - reusing CaseDetailPanel */}
      <Dialog open={!!detailCase} onOpenChange={() => setDetailCase(null)}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto p-3 md:p-6 rounded-xl">
          {detailCase && (
            <CaseDetailPanel
              caso={detailCase}
              onClose={() => setDetailCase(null)}
              statusColor={statusColor}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CaseCard({
  caso,
  onView,
  onDownload,
  downloading,
}: {
  caso: any;
  onView: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const badge = statusBadge(caso.status);

  return (
    <Card className="hover:border-primary/20 transition-colors group">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 mt-0.5">
            <PenTool size={16} className="text-primary/70" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-sm font-heading font-bold text-foreground truncate">
                {caso.titulo || caso.nome_requerente || "Caso"}
              </h4>
              <Badge
                variant="outline"
                className={`${badge.bg} ${badge.text} text-[10px] font-mono uppercase tracking-wider border-0 shrink-0`}
              >
                {badge.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              {caso.tipo_servico && (
                <span className="flex items-center gap-1">
                  <Shield size={10} />
                  {caso.tipo_servico}
                </span>
              )}
              {caso.sigla_unidade_pf && (
                <span>{caso.sigla_unidade_pf}</span>
              )}
              <span className="tabular-nums">
                {new Date(caso.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {caso.geracao_id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={onDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={onView}
            >
              <Eye size={14} />
            </Button>
            <ChevronRight size={14} className="text-muted-foreground/40 hidden sm:block" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

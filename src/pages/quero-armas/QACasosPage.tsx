import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import CaseDetailPanel from "@/components/quero-armas/CaseDetailPanel";
import {
  Search, FolderOpen, PenTool, CheckCircle, XCircle, Clock, Eye,
  Shield, BookOpen,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "em_geracao", label: "Em geração" },
  { value: "gerado", label: "Gerado" },
  { value: "revisado", label: "Revisado" },
  { value: "deferido", label: "Deferido" },
  { value: "indeferido", label: "Indeferido" },
  { value: "arquivado", label: "Arquivado" },
];

export default function QACasosPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [detailCase, setDetailCase] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("casos");

  const load = async () => {
    setLoading(true);
    let query = supabase.from("qa_casos" as any).select("*").order("created_at", { ascending: false }).limit(100);
    if (statusFilter !== "todos") query = query.eq("status", statusFilter);
    const { data } = await query;
    setCases((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = cases.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.nome_requerente || "").toLowerCase().includes(s) ||
      (c.titulo || "").toLowerCase().includes(s) ||
      (c.tipo_servico || "").toLowerCase().includes(s) ||
      (c.unidade_pf || "").toLowerCase().includes(s) ||
      (c.cidade || "").toLowerCase().includes(s);
  });

  const casosAtivos = filtered.filter(c => c.status !== "deferido");
  const servicosConcluidos = filtered.filter(c => c.status === "deferido");

  const statusBadge = (s: string) => {
    if (s === "gerado" || s === "revisado") return { bg: "bg-emerald-50", text: "text-emerald-700" };
    if (s === "deferido") return { bg: "bg-green-50", text: "text-green-700" };
    if (s === "indeferido") return { bg: "bg-red-50", text: "text-red-600" };
    if (s === "em_geracao") return { bg: "bg-blue-50", text: "text-blue-600" };
    if (s === "arquivado") return { bg: "bg-slate-100", text: "text-slate-500" };
    if (s === "rascunho") return { bg: "bg-amber-50", text: "text-amber-700" };
    return { bg: "bg-slate-100", text: "text-slate-500" };
  };

  const statusColor = (s: string) => statusBadge(s).text;

  const handleSetDeferido = useCallback(async (casoId: string) => {
    try {
      await supabase.from("qa_casos" as any).update({ status: "deferido", updated_at: new Date().toISOString() }).eq("id", casoId);
      const { data: auxDocs } = await supabase.from("qa_documentos_conhecimento" as any)
        .select("id").eq("caso_id", casoId).eq("papel_documento", "auxiliar_caso");
      if (auxDocs && auxDocs.length > 0) {
        const docIds = (auxDocs as any[]).map(d => d.id);
        await supabase.from("qa_documentos_conhecimento" as any)
          .update({ papel_documento: "aprendizado", ativo_na_ia: true, updated_at: new Date().toISOString() }).in("id", docIds);
      }
      await supabase.from("qa_logs_auditoria" as any).insert({
        entidade: "qa_casos", entidade_id: casoId, acao: "marcar_deferido",
        detalhes_json: { docs_promovidos: auxDocs?.length || 0 },
      });
      toast.success("Caso marcado como deferido. Documentos promovidos para aprendizado da IA.");
      setDetailCase(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    }
  }, []);

  const handleSetIndeferido = useCallback(async (casoId: string) => {
    try {
      await supabase.from("qa_casos" as any).update({ status: "indeferido", updated_at: new Date().toISOString() }).eq("id", casoId);
      toast.success("Caso marcado como indeferido.");
      setDetailCase(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    }
  }, []);

  const renderCaseList = (items: any[]) => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="text-center py-16">
          <FolderOpen className="h-12 w-12 mx-auto mb-3" style={{ color: "hsl(220 13% 85%)" }} />
          <p className="text-sm" style={{ color: "hsl(220 10% 55%)" }}>Nenhum caso encontrado</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((c: any) => {
          const badge = statusBadge(c.status);
          return (
            <div key={c.id} className="qa-card qa-hover-lift p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate uppercase" style={{ color: "hsl(220 20% 18%)" }}>
                    {c.nome_requerente || "—"}
                  </div>
                  <div className="text-[11px] truncate uppercase" style={{ color: "hsl(220 10% 55%)" }}>
                    {c.titulo || "Sem título"}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="qa-badge text-[10px] uppercase">{c.tipo_servico || "—"}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text} uppercase`}>
                      {(c.status || "—").replace(/_/g, " ")}
                    </span>
                    {c.sigla_unidade_pf && (
                      <span className="text-[10px] tabular-nums uppercase" style={{ color: "hsl(220 10% 62%)" }}>{c.sigla_unidade_pf}</span>
                    )}
                    <span className="text-[10px] tabular-nums" style={{ color: "hsl(220 10% 62%)" }}>
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setDetailCase(c)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ color: "hsl(220 10% 55%)" }}>
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => navigate(`/quero-armas/gerar-peca?caso=${c.id}`)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors" style={{ color: "hsl(220 10% 55%)" }}>
                    <PenTool className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>Casos</h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Gestão de processos e peças</p>
        </div>
        <button onClick={() => navigate("/quero-armas/gerar-peca")} className="qa-btn-primary flex items-center gap-1.5 no-glow">
          <PenTool className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Novo</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "hsl(220 10% 55%)" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border bg-white text-sm uppercase outline-none transition-all"
            style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 20% 18%)" }}
            onFocus={e => e.currentTarget.style.borderColor = "hsl(230 80% 56%)"}
            onBlur={e => e.currentTarget.style.borderColor = "hsl(220 13% 91%)"}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-full sm:w-36 bg-white border-slate-200 text-slate-700 rounded-xl text-xs uppercase">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value} className="uppercase">{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border rounded-xl p-1 w-fit" style={{ borderColor: "hsl(220 13% 91%)" }}>
        <button onClick={() => setActiveTab("casos")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === "casos" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}>
          <FolderOpen className="h-3.5 w-3.5" /> Casos ({casosAtivos.length})
        </button>
        <button onClick={() => setActiveTab("servicos")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === "servicos" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}>
          <Shield className="h-3.5 w-3.5" /> Deferidos ({servicosConcluidos.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === "casos" ? renderCaseList(casosAtivos) : (
        servicosConcluidos.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 mx-auto mb-3" style={{ color: "hsl(220 13% 85%)" }} />
            <p className="text-sm" style={{ color: "hsl(220 10% 55%)" }}>Nenhum serviço deferido ainda</p>
            <p className="text-xs mt-1" style={{ color: "hsl(220 10% 70%)" }}>Marque um caso como "Deferido" para promovê-lo ao aprendizado da IA.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border bg-emerald-50 border-emerald-200">
              <BookOpen className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="text-xs text-emerald-700">Casos deferidos têm seus documentos promovidos para aprendizado da IA. As defesas bem-sucedidas servem como modelo para futuros casos semelhantes.</span>
            </div>
            {renderCaseList(servicosConcluidos)}
          </>
        )
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailCase} onOpenChange={() => setDetailCase(null)}>
        <DialogContent className="bg-white border-slate-200 max-w-3xl max-h-[85vh] overflow-y-auto p-3 md:p-6 rounded-xl">
          {detailCase && (
            <CaseDetailPanel
              caso={detailCase}
              onClose={() => setDetailCase(null)}
              onDeferido={handleSetDeferido}
              onIndeferido={handleSetIndeferido}
              onEdit={(id) => { setDetailCase(null); navigate(`/quero-armas/gerar-peca?caso=${id}`); }}
              statusColor={statusColor}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

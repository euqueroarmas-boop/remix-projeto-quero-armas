import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CaseDetailPanel from "@/components/quero-armas/CaseDetailPanel";
import {
  Search, FolderOpen, PenTool, CheckCircle, XCircle, Clock, Eye,
  Shield, BookOpen, ChevronRight,
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

  // Separate cases from services (deferido cases go to learning)
  const casosAtivos = filtered.filter(c => c.status !== "deferido");
  const servicosConcluidos = filtered.filter(c => c.status === "deferido");

  const statusColor = (s: string) => {
    if (s === "gerado" || s === "revisado") return "text-emerald-400";
    if (s === "deferido") return "text-green-400";
    if (s === "indeferido") return "text-red-400";
    if (s === "em_geracao") return "text-slate-600";
    if (s === "arquivado") return "text-slate-400";
    if (s === "rascunho") return "text-amber-400";
    return "text-slate-500";
  };

  const handleSetDeferido = useCallback(async (casoId: string) => {
    try {
      // Update status to deferido
      await supabase.from("qa_casos" as any).update({
        status: "deferido",
        updated_at: new Date().toISOString(),
      }).eq("id", casoId);

      // Promote auxiliary docs to learning
      const { data: auxDocs } = await supabase.from("qa_documentos_conhecimento" as any)
        .select("id")
        .eq("caso_id", casoId)
        .eq("papel_documento", "auxiliar_caso");

      if (auxDocs && auxDocs.length > 0) {
        const docIds = (auxDocs as any[]).map(d => d.id);
        await supabase.from("qa_documentos_conhecimento" as any)
          .update({
            papel_documento: "aprendizado",
            ativo_na_ia: true,
            updated_at: new Date().toISOString(),
          })
          .in("id", docIds);
      }

      // Audit log
      await supabase.from("qa_logs_auditoria" as any).insert({
        entidade: "qa_casos",
        entidade_id: casoId,
        acao: "marcar_deferido",
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
      await supabase.from("qa_casos" as any).update({
        status: "indeferido",
        updated_at: new Date().toISOString(),
      }).eq("id", casoId);

      toast.success("Caso marcado como indeferido.");
      setDetailCase(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    }
  }, []);

  const renderCaseList = (items: any[]) => {
    if (loading) {
      return <div className="flex justify-center py-10"><div className="w-4 h-4 border-2 border-slate-200 border-t-neutral-500 rounded-full animate-spin" /></div>;
    }
    if (items.length === 0) {
      return <div className="text-center py-10 text-slate-400 text-[11px]">Nenhum caso encontrado</div>;
    }

    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_140px_120px_100px_80px_80px_50px] gap-2 px-3 py-1.5 border-b border-slate-200 text-[9px] text-slate-400 uppercase tracking-[0.12em]">
          <span>Requerente / Título</span><span>Serviço</span><span>Tipo Peça</span><span>Unidade PF</span><span>Status</span><span>Data</span><span></span>
        </div>
        {items.map((c: any) => (
          <div key={c.id} className="border-b border-slate-200/40 hover:bg-slate-50 transition-colors">
            <div className="md:hidden px-2.5 py-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-slate-700 truncate font-medium">{c.nome_requerente || "—"}</div>
                  <div className="text-[9px] text-slate-400 truncate">{c.titulo || "Sem título"}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[9px] font-mono ${statusColor(c.status)}`}>{(c.status || "—").replace(/_/g, " ")}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[9px] text-slate-400">
                <span className="truncate">{c.tipo_servico || "—"}</span>
                <span className="font-mono">{c.sigla_unidade_pf || "—"}</span>
                <span className="font-mono tabular-nums ml-auto">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                <button onClick={() => setDetailCase(c)} className="p-0.5 text-slate-400 hover:text-[#c43b52]"><Eye className="h-3 w-3" /></button>
                <button onClick={() => navigate(`/quero-armas/gerar-peca?caso=${c.id}`)} className="p-0.5 text-slate-400 hover:text-[#c43b52]"><PenTool className="h-3 w-3" /></button>
              </div>
            </div>
            <div className="hidden md:grid grid-cols-[1fr_140px_120px_100px_80px_80px_50px] gap-2 px-3 py-2 items-center">
              <div className="min-w-0">
                <div className="text-[12px] text-slate-700 truncate font-medium">{c.nome_requerente || "—"}</div>
                <div className="text-[10px] text-slate-400 truncate">{c.titulo || "Sem título"}</div>
              </div>
              <div className="text-[10px] text-slate-500 truncate">{c.tipo_servico || "—"}</div>
              <div className="text-[10px] text-slate-500 truncate">{(c.tipo_peca || "—").replace(/_/g, " ")}</div>
              <div className="text-[10px] text-slate-400 font-mono truncate">{c.sigla_unidade_pf || "—"}</div>
              <div className={`text-[10px] font-mono ${statusColor(c.status)}`}>{(c.status || "—").replace(/_/g, " ")}</div>
              <div className="text-[10px] text-slate-300 font-mono tabular-nums">{new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
              <div className="flex gap-0.5 justify-end">
                <button onClick={() => setDetailCase(c)} className="p-1 text-slate-400 hover:text-[#c43b52]"><Eye className="h-3.5 w-3.5" /></button>
                <button onClick={() => navigate(`/quero-armas/gerar-peca?caso=${c.id}`)} className="p-1 text-slate-400 hover:text-[#c43b52]"><PenTool className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3 md:space-y-4 max-w-6xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-sm md:text-base font-semibold text-slate-700">Casos</h1>
        <Button size="sm" onClick={() => navigate("/quero-armas/gerar-peca")}
          className="bg-[#7a1528] hover:bg-[#a52338] text-white border-0 h-7 text-[10px] md:text-[11px] active:scale-[0.98]">
          <PenTool className="h-3 w-3 mr-1" /> Novo
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-1.5 md:gap-2">
        <div className="relative flex-1">
          <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="bg-white border-slate-200 text-slate-700 pl-7 h-7 md:h-8 text-[11px] focus:border-blue-500" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-white border-slate-200 text-slate-600 h-7 md:h-8 w-full sm:w-28 text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-slate-200 h-8">
          <TabsTrigger value="casos" className="text-[10px] data-[state=active]:bg-slate-800 data-[state=active]:text-slate-700">
            <FolderOpen className="h-3 w-3 mr-1" /> Casos ({casosAtivos.length})
          </TabsTrigger>
          <TabsTrigger value="servicos" className="text-[10px] data-[state=active]:bg-slate-800 data-[state=active]:text-slate-700">
            <Shield className="h-3 w-3 mr-1" /> Serviços Deferidos ({servicosConcluidos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="casos" className="mt-3">
          {renderCaseList(casosAtivos)}
        </TabsContent>

        <TabsContent value="servicos" className="mt-3">
          {servicosConcluidos.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <BookOpen className="h-6 w-6 text-slate-300 mx-auto" />
              <div className="text-slate-400 text-[11px]">Nenhum serviço deferido ainda</div>
              <div className="text-slate-300 text-[10px]">Marque um caso como "Deferido" para promovê-lo ao aprendizado da IA.</div>
            </div>
          ) : (
            <>
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5 mb-3 text-[10px] text-emerald-400/80 flex items-start gap-2">
                <BookOpen className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Casos deferidos têm seus documentos promovidos para aprendizado da IA. As defesas bem-sucedidas servem como modelo para futuros casos semelhantes.</span>
              </div>
              {renderCaseList(servicosConcluidos)}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!detailCase} onOpenChange={() => setDetailCase(null)}>
        <DialogContent className="bg-white border-slate-200 text-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto p-3 md:p-6">
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